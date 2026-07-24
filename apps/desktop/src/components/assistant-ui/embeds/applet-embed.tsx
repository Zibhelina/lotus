'use client'

import { type CSSProperties, type ReactNode, useContext, useEffect, useMemo, useRef } from 'react'

import { notify } from '@/store/notifications'

import { AppletBridgeContext } from './applet-bridge-context'
import type { RichFenceProps } from './types'

const DEFAULT_HEIGHT = 420
const MAX_HTML_BYTES = 256 * 1024
const MAX_SUBMIT_TEXT_LENGTH = 16 * 1024
const MOUNT_GUARD_MS = 500
const SUBMIT_DEBOUNCE_MS = 2_000
const HTML_SANDBOX = 'allow-scripts allow-forms'
const URL_SANDBOX = `${HTML_SANDBOX} allow-same-origin`

interface AppletDescriptor {
  aspectRatio?: number
  height: number
  html?: string
  mode: 'html' | 'url'
  url?: string
}

type ParseResult = { descriptor: AppletDescriptor } | { reason?: string }

interface AppletRendererProps extends RichFenceProps {
  fallback?: ReactNode
}

function parseApplet(code: string): ParseResult {
  let input: unknown

  try {
    input = JSON.parse(code)
  } catch {
    return {}
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }

  const value = input as Record<string, unknown>

  const height =
    typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0
      ? value.height
      : DEFAULT_HEIGHT

  const aspectRatio =
    typeof value.aspectRatio === 'number' && Number.isFinite(value.aspectRatio) && value.aspectRatio > 0
      ? value.aspectRatio
      : undefined

  if (typeof value.html === 'string' && value.html.length > 0) {
    if (new Blob([value.html]).size > MAX_HTML_BYTES) {
      return {}
    }

    return { descriptor: { aspectRatio, height, html: value.html, mode: 'html' } }
  }

  if (typeof value.url !== 'string' || value.url.length === 0) {
    return {}
  }

  let url: URL

  try {
    url = new URL(value.url)
  } catch {
    return { reason: 'Applet URLs must use HTTP on localhost or 127.0.0.1.' }
  }

  if (url.protocol !== 'http:' || (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1')) {
    return { reason: 'Applet URLs must use HTTP on localhost or 127.0.0.1.' }
  }

  return { descriptor: { aspectRatio, height, mode: 'url', url: url.href } }
}

function AppletFallback({ fallback, reason }: { fallback: ReactNode; reason?: string }) {
  if (!reason) {
    return <>{fallback}</>
  }

  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{reason}</p>
      {fallback}
    </div>
  )
}

export default function AppletRenderer({ code, fallback = <pre>{code}</pre>, streaming }: AppletRendererProps) {
  const bridge = useContext(AppletBridgeContext)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const mountedAtRef = useRef(0)
  const lastSubmitAtRef = useRef(Number.NEGATIVE_INFINITY)
  const parsed = useMemo(() => parseApplet(code), [code])

  useEffect(() => {
    if ('descriptor' in parsed && !streaming) {
      mountedAtRef.current = Date.now()
      lastSubmitAtRef.current = Number.NEGATIVE_INFINITY
    }
  }, [parsed, streaming])

  useEffect(() => {
    if (!('descriptor' in parsed) || streaming) {
      return
    }

    const onMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow
      const data: unknown = event.data

      if (
        !iframeWindow ||
        event.source !== iframeWindow ||
        !data ||
        typeof data !== 'object' ||
        (data as Record<string, unknown>).lotus !== 1
      ) {
        return
      }

      const message = data as Record<string, unknown>

      if (message.type === 'notify') {
        const title = typeof message.title === 'string' ? message.title.trim() : ''

        notify({ message: title || 'Applet notification' })

        return
      }

      if (message.type !== 'submit' || typeof message.text !== 'string' || message.text.length > MAX_SUBMIT_TEXT_LENGTH) {
        return
      }

      const now = Date.now()

      if (
        !bridge ||
        now - mountedAtRef.current < MOUNT_GUARD_MS ||
        now - lastSubmitAtRef.current < SUBMIT_DEBOUNCE_MS
      ) {
        return
      }

      lastSubmitAtRef.current = now
      bridge.submitText(message.text)
      iframeWindow.postMessage({ lotus: 1, ok: true, type: 'ack' }, '*')
    }

    window.addEventListener('message', onMessage)

    return () => window.removeEventListener('message', onMessage)
  }, [bridge, parsed, streaming])

  if (streaming || !('descriptor' in parsed)) {
    return <AppletFallback fallback={fallback} reason={'reason' in parsed ? parsed.reason : undefined} />
  }

  const { descriptor } = parsed

  const style: CSSProperties = descriptor.aspectRatio
    ? { aspectRatio: descriptor.aspectRatio }
    : { height: descriptor.height }

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-background">
      <iframe
        className="block w-full border-0 bg-transparent"
        ref={iframeRef}
        sandbox={descriptor.mode === 'html' ? HTML_SANDBOX : URL_SANDBOX}
        src={descriptor.mode === 'url' ? descriptor.url : undefined}
        srcDoc={descriptor.mode === 'html' ? descriptor.html : undefined}
        style={style}
        title="Lotus applet"
      />
      {!bridge && <p className="mt-1 text-xs text-muted-foreground">Submit-back is unavailable in this view.</p>}
    </div>
  )
}
