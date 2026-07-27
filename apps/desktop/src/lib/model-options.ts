import { getGlobalModelOptions, type HermesGateway, type ModelOptionsResponse } from '@/hermes'
import type { ModelOptionProvider } from '@/types/hermes'

const LOTUS_OPENROUTER_MODEL = 'google/gemini-3.5-flash-lite'

/** Add Lotus-curated OpenRouter models that the connected Hermes runtime may
 * not have learned about yet. The override stays at the desktop edge so Lotus
 * can offer a newly released model without mutating backend-owned config. */
export function withLotusOpenRouterModels(response: ModelOptionsResponse): ModelOptionsResponse {
  const providers = response.providers

  if (!providers?.length) {
    return response
  }

  let changed = false

  const nextProviders = providers.map(provider => {
    if (provider.slug !== 'openrouter') {
      return provider
    }

    const current = provider.models ?? []

    if (current.includes(LOTUS_OPENROUTER_MODEL)) {
      return provider
    }

    changed = true
    const models = [...current]
    const anchor = models.indexOf('google/gemini-3.5-flash')
    models.splice(anchor >= 0 ? anchor + 1 : models.length, 0, LOTUS_OPENROUTER_MODEL)

    return {
      ...provider,
      models,
      ...(provider.total_models === undefined ? {} : { total_models: provider.total_models + 1 })
    }
  })

  return changed ? { ...response, providers: nextProviders } : response
}

/**
 * True only when a persisted **manual** composer pick has been removed from the
 * catalog (its provider still ships models, but no longer this one) — so a new
 * chat would keep 404'ing the dead model. Deliberately conservative to never
 * clobber a still-valid pick: an unknown/absent provider, an empty model list
 * (re-auth / unconfigured), or a not-yet-loaded catalog all return false.
 */
export function manualPickRemoved(
  providers: ModelOptionProvider[] | undefined,
  provider: string,
  model: string
): boolean {
  if (!providers?.length || !provider || !model) {
    return false
  }

  const row = providers.find(p => p.slug === provider || p.name === provider)

  if (!row) {
    return false
  }

  const models = row.models ?? []

  // Empty list means the provider is present but unconfigured / awaiting
  // re-auth, not that the model was dropped — leave the pick alone.
  if (models.length === 0) {
    return false
  }

  return !models.includes(model)
}

interface ModelOptionsRequest {
  /** When false, include ambient/unconfigured providers (onboarding/setup
   *  surfaces). Chat pickers default to true so only explicitly configured
   *  providers are listed (#56974). */
  explicitOnly?: boolean
  gateway?: HermesGateway
  refresh?: boolean
  sessionId?: null | string
}

export function modelOptionsQueryKey(profile: null | string | undefined, sessionId?: null | string) {
  const profileKey = (profile ?? '').trim() || 'default'

  return ['model-options', profileKey, sessionId || 'global'] as const
}

export function requestModelOptions({
  explicitOnly = true,
  gateway,
  refresh = false,
  sessionId
}: ModelOptionsRequest): Promise<ModelOptionsResponse> {
  if (gateway) {
    const params: Record<string, unknown> = {}

    if (sessionId) {
      params.session_id = sessionId
    }

    if (refresh) {
      params.refresh = true
    }

    if (explicitOnly) {
      params.explicit_only = true
    }

    return gateway.request<ModelOptionsResponse>('model.options', params).then(withLotusOpenRouterModels)
  }

  return getGlobalModelOptions({ explicitOnly, ...(refresh ? { refresh: true } : {}) }).then(withLotusOpenRouterModels)
}
