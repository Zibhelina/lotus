import { afterEach, describe, expect, it, vi } from 'vitest'

import { getGlobalModelOptions } from '@/hermes'

import {
  manualPickRemoved,
  modelOptionsQueryKey,
  requestModelOptions,
  withLotusOpenRouterModels
} from './model-options'

const globalOptions = { model: 'hermes-4', provider: 'nous', providers: [] }

vi.mock('@/hermes', () => ({
  getGlobalModelOptions: vi.fn(() => Promise.resolve(globalOptions))
}))

describe('requestModelOptions', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses the connected gateway even before a session exists', async () => {
    const gatewayPayload = { model: 'BeastMode', provider: 'moa', providers: [] }

    const gateway = {
      request: vi.fn(() => Promise.resolve(gatewayPayload))
    }

    await expect(requestModelOptions({ gateway: gateway as never, sessionId: null })).resolves.toBe(gatewayPayload)

    expect(gateway.request).toHaveBeenCalledWith('model.options', { explicit_only: true })
    expect(getGlobalModelOptions).not.toHaveBeenCalled()
  })

  it('passes the active session id and refresh flag through the gateway', async () => {
    const gateway = {
      request: vi.fn(() => Promise.resolve(globalOptions))
    }

    await requestModelOptions({ gateway: gateway as never, refresh: true, sessionId: 'session-1' })

    expect(gateway.request).toHaveBeenCalledWith('model.options', {
      explicit_only: true,
      refresh: true,
      session_id: 'session-1'
    })
  })

  it('adds the Lotus OpenRouter model to the live gateway catalog', async () => {
    const gateway = {
      request: vi.fn(() =>
        Promise.resolve({
          providers: [
            {
              models: ['google/gemini-3.5-flash'],
              name: 'OpenRouter',
              slug: 'openrouter'
            }
          ]
        })
      )
    }

    const result = await requestModelOptions({ gateway: gateway as never })

    expect(result.providers?.[0].models).toEqual([
      'google/gemini-3.5-flash',
      'google/gemini-3.5-flash-lite'
    ])
  })

  it('falls back to REST when no gateway is connected', async () => {
    await requestModelOptions({ refresh: true })

    expect(getGlobalModelOptions).toHaveBeenCalledWith({ explicitOnly: true, refresh: true })
  })
})

describe('withLotusOpenRouterModels', () => {
  it('offers Gemini 3.5 Flash Lite beside Gemini 3.5 Flash', () => {
    const response = {
      providers: [
        {
          models: ['google/gemini-3.5-flash', 'x-ai/grok-4.5'],
          name: 'OpenRouter',
          slug: 'openrouter',
          total_models: 2
        }
      ]
    }

    const result = withLotusOpenRouterModels(response)
    const openrouter = result.providers?.[0]

    expect(openrouter?.models).toEqual([
      'google/gemini-3.5-flash',
      'google/gemini-3.5-flash-lite',
      'x-ai/grok-4.5'
    ])
    expect(openrouter?.total_models).toBe(3)
    expect(response.providers[0].models).toEqual(['google/gemini-3.5-flash', 'x-ai/grok-4.5'])
  })

  it('does not duplicate the model once the backend catalog includes it', () => {
    const response = {
      providers: [
        {
          models: ['google/gemini-3.5-flash-lite'],
          name: 'OpenRouter',
          slug: 'openrouter',
          total_models: 1
        }
      ]
    }

    expect(withLotusOpenRouterModels(response)).toBe(response)
    expect(response.providers[0].models).toEqual(['google/gemini-3.5-flash-lite'])
    expect(response.providers[0].total_models).toBe(1)
  })

  it('does not invent an OpenRouter provider when it is not configured', () => {
    const response = { providers: [{ models: ['hermes-4'], name: 'Nous', slug: 'nous' }] }

    expect(withLotusOpenRouterModels(response)).toBe(response)
  })
})

describe('modelOptionsQueryKey', () => {
  it('isolates new-chat catalogs by active gateway profile', () => {
    expect(modelOptionsQueryKey('default')).toEqual(['model-options', 'default', 'global'])
    expect(modelOptionsQueryKey('compass')).toEqual(['model-options', 'compass', 'global'])
    expect(modelOptionsQueryKey('default')).not.toEqual(modelOptionsQueryKey('compass'))
  })

  it('keeps session catalogs inside the owning profile namespace', () => {
    expect(modelOptionsQueryKey(' compass ', 'session-1')).toEqual(['model-options', 'compass', 'session-1'])
  })
})

describe('manualPickRemoved', () => {
  const providers = [
    { name: 'OpenRouter', slug: 'openrouter', models: ['owl-alpha', 'gpt-5.5'] },
    { name: 'Nous', slug: 'nous', models: [] } // present but unconfigured / re-auth
  ]

  it('flags a pick whose model was dropped from a populated provider', () => {
    expect(manualPickRemoved(providers, 'openrouter', 'nemotron-removed')).toBe(true)
  })

  it('keeps a pick that is still in the catalog', () => {
    expect(manualPickRemoved(providers, 'openrouter', 'gpt-5.5')).toBe(false)
  })

  it('matches the provider by name as well as slug', () => {
    expect(manualPickRemoved(providers, 'OpenRouter', 'gpt-5.5')).toBe(false)
    expect(manualPickRemoved(providers, 'OpenRouter', 'gone')).toBe(true)
  })

  it('never clobbers when the provider is absent (ambiguous / deauth)', () => {
    expect(manualPickRemoved(providers, 'anthropic', 'claude-sonnet-4.6')).toBe(false)
  })

  it('never clobbers when the provider has an empty model list (re-auth)', () => {
    expect(manualPickRemoved(providers, 'nous', 'hermes-4')).toBe(false)
  })

  it('never clobbers on a not-yet-loaded or empty catalog', () => {
    expect(manualPickRemoved(undefined, 'openrouter', 'gpt-5.5')).toBe(false)
    expect(manualPickRemoved([], 'openrouter', 'gpt-5.5')).toBe(false)
  })

  it('never clobbers when there is no pick', () => {
    expect(manualPickRemoved(providers, '', '')).toBe(false)
  })
})
