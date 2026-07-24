import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppletBridgeContext } from './applet-bridge-context'
import AppletRenderer from './applet-embed'

const fallback = <div data-testid="fallback">raw applet source</div>

function renderApplet(code: string, submitText?: (text: string) => void) {
  const renderer = <AppletRenderer code={code} fallback={fallback} />

  return render(
    submitText ? <AppletBridgeContext.Provider value={{ submitText }}>{renderer}</AppletBridgeContext.Provider> : renderer
  )
}

function sendAppletMessage(iframe: HTMLIFrameElement, data: unknown, source: MessageEventSource | null = iframe.contentWindow) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source }))
  })
}

describe('AppletRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the fallback for invalid JSON', () => {
    renderApplet('{not json')

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.queryByTitle('Lilypad applet')).toBeNull()
  })

  it('renders the fallback with a visible reason for a non-local URL', () => {
    renderApplet(JSON.stringify({ url: 'https://example.com/applet' }))

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.getByText(/localhost/i)).not.toBeNull()
    expect(screen.queryByTitle('Lilypad applet')).toBeNull()
  })

  it('renders inline HTML without same-origin sandbox access', () => {
    renderApplet(JSON.stringify({ height: 360, html: '<!doctype html><button>Submit</button>' }))

    const iframe = screen.getByTitle('Lilypad applet')

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin')
    expect(iframe.getAttribute('srcdoc')).toBe('<!doctype html><button>Submit</button>')
    expect((iframe as HTMLIFrameElement).style.height).toBe('360px')
  })

  it('ignores wrong sources and protocol versions, accepts one valid submit, acks it, and debounces the next', () => {
    const submitText = vi.fn()

    renderApplet(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }), submitText)

    const iframe = screen.getByTitle('Lilypad applet') as HTMLIFrameElement
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')

    act(() => vi.advanceTimersByTime(500))

    sendAppletMessage(iframe, { lilypad: 1, text: 'wrong source', type: 'submit' }, window)
    sendAppletMessage(iframe, { lilypad: 2, text: 'wrong version', type: 'submit' })
    sendAppletMessage(iframe, { lilypad: 1, text: 'accepted', type: 'submit' })
    sendAppletMessage(iframe, { lilypad: 1, text: 'too soon', type: 'submit' })

    expect(submitText).toHaveBeenCalledTimes(1)
    expect(submitText).toHaveBeenCalledWith('accepted')
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith({ lilypad: 1, ok: true, type: 'ack' }, '*')
  })

  it('ignores submits received before the mount guard elapses', () => {
    const submitText = vi.fn()

    renderApplet(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }), submitText)
    const iframe = screen.getByTitle('Lilypad applet') as HTMLIFrameElement

    act(() => vi.advanceTimersByTime(499))
    sendAppletMessage(iframe, { lilypad: 1, text: 'auto-fired', type: 'submit' })

    expect(submitText).not.toHaveBeenCalled()
  })

  it('renders a bridge-unavailable hint and drops submits without a provider', () => {
    renderApplet(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }))

    const iframe = screen.getByTitle('Lilypad applet') as HTMLIFrameElement
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')

    expect(screen.getByText(/submit-back is unavailable/i)).not.toBeNull()

    act(() => vi.advanceTimersByTime(500))
    sendAppletMessage(iframe, { lilypad: 1, text: 'dropped', type: 'submit' })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('rejects submit text over 16 KB', () => {
    const submitText = vi.fn()

    renderApplet(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }), submitText)
    const iframe = screen.getByTitle('Lilypad applet') as HTMLIFrameElement
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')

    act(() => vi.advanceTimersByTime(500))
    sendAppletMessage(iframe, { lilypad: 1, text: 'x'.repeat(16_385), type: 'submit' })

    expect(submitText).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('renders the fallback when inline HTML exceeds 256 KB', () => {
    renderApplet(JSON.stringify({ html: 'x'.repeat(256 * 1024 + 1) }))

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.queryByTitle('Lilypad applet')).toBeNull()
  })

  it('renders the fallback while streaming', () => {
    render(<AppletRenderer code={JSON.stringify({ html: '<p>partial</p>' })} fallback={fallback} streaming />)

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.queryByTitle('Lilypad applet')).toBeNull()
  })

  it('uses aspect ratio instead of fixed height when provided', () => {
    renderApplet(JSON.stringify({ aspectRatio: 16 / 9, height: 900, html: '<p>ratio</p>' }))

    expect(Number.parseFloat((screen.getByTitle('Lilypad applet') as HTMLIFrameElement).style.aspectRatio)).toBeCloseTo(
      16 / 9
    )
  })

  it('allows URL mode only for HTTP localhost and grants same-origin in its sandbox', () => {
    renderApplet(JSON.stringify({ url: 'http://localhost:2600/applets/test' }))

    const iframe = screen.getByTitle('Lilypad applet')

    expect(iframe.getAttribute('src')).toBe('http://localhost:2600/applets/test')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms allow-same-origin')
  })
})
