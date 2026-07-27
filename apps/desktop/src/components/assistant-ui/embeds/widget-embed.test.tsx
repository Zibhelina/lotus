import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RICH_FENCE_LANGUAGES } from './registry'
import { WidgetBridgeContext } from './widget-bridge-context'
import WidgetRenderer from './widget-embed'

const fallback = <div data-testid="fallback">raw widget source</div>

function renderWidget(code: string, submitText?: (text: string) => void) {
  const renderer = <WidgetRenderer code={code} fallback={fallback} />

  return render(
    submitText ? (
      <WidgetBridgeContext.Provider value={{ submitText }}>{renderer}</WidgetBridgeContext.Provider>
    ) : (
      renderer
    )
  )
}

function sendWidgetMessage(
  iframe: HTMLIFrameElement,
  data: unknown,
  source: MessageEventSource | null = iframe.contentWindow,
  origin = ''
) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }))
  })
}

describe('WidgetRenderer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the fallback for invalid JSON', () => {
    renderWidget('{not json')

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.queryByTitle('Lotus widget')).toBeNull()
  })

  it('renders the fallback with a visible reason for a non-local URL', () => {
    renderWidget(JSON.stringify({ url: 'https://example.com/widget' }))

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.getByText(/localhost/i)).not.toBeNull()
    expect(screen.queryByTitle('Lotus widget')).toBeNull()
  })

  it('renders inline HTML without same-origin sandbox access', () => {
    renderWidget(JSON.stringify({ height: 360, html: '<!doctype html><button>Submit</button>' }))

    const iframe = screen.getByTitle('Lotus widget')

    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms')
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin')
    expect(iframe.getAttribute('srcdoc')).toBe('<!doctype html><button>Submit</button>')
    expect((iframe as HTMLIFrameElement).style.height).toBe('360px')
  })

  it('ignores wrong sources and protocol versions, accepts one valid submit, acks it, and debounces the next', () => {
    const submitText = vi.fn()

    renderWidget(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }), submitText)

    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')

    act(() => vi.advanceTimersByTime(500))

    sendWidgetMessage(iframe, { lotus: 1, text: 'wrong source', type: 'submit' }, window)
    sendWidgetMessage(iframe, { lotus: 2, text: 'wrong version', type: 'submit' })
    sendWidgetMessage(iframe, { lotus: 1, text: 'accepted', type: 'submit' })
    sendWidgetMessage(iframe, { lotus: 1, text: 'too soon', type: 'submit' })

    expect(submitText).toHaveBeenCalledTimes(1)
    expect(submitText).toHaveBeenCalledWith('accepted')
    expect(postMessage).toHaveBeenCalledTimes(1)
    expect(postMessage).toHaveBeenCalledWith({ lotus: 1, ok: true, type: 'ack' }, '*')
  })

  it('resizes height-based widgets from trusted bridge messages and clamps extreme heights', () => {
    renderWidget(JSON.stringify({ height: 480, html: '<!doctype html><main>Widget</main>' }))
    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement

    sendWidgetMessage(iframe, { height: 736.2, lotus: 1, type: 'resize' }, window)
    expect(iframe.style.height).toBe('480px')

    sendWidgetMessage(iframe, { height: 736.2, lotus: 1, type: 'resize' })
    expect(iframe.style.height).toBe('737px')

    sendWidgetMessage(iframe, { height: 99_999, lotus: 1, type: 'resize' })
    expect(iframe.style.height).toBe('8192px')
  })

  it('rejects messages after a URL widget navigates away from its declared origin', () => {
    const submitText = vi.fn()
    renderWidget(JSON.stringify({ url: 'http://127.0.0.1:2600/widgets/test' }), submitText)
    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement

    act(() => vi.advanceTimersByTime(500))
    sendWidgetMessage(
      iframe,
      { lotus: 1, text: 'remote page', type: 'submit' },
      iframe.contentWindow,
      'https://example.com'
    )
    sendWidgetMessage(
      iframe,
      { lotus: 1, text: 'local widget', type: 'submit' },
      iframe.contentWindow,
      'http://127.0.0.1:2600'
    )

    expect(submitText).toHaveBeenCalledTimes(1)
    expect(submitText).toHaveBeenCalledWith('local widget')
  })

  it('keeps explicit aspect-ratio widgets fixed when they send resize messages', () => {
    renderWidget(JSON.stringify({ aspectRatio: 16 / 9, html: '<!doctype html><main>Widget</main>' }))
    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement

    sendWidgetMessage(iframe, { height: 700, lotus: 1, type: 'resize' })

    expect(Number.parseFloat(iframe.style.aspectRatio)).toBeCloseTo(16 / 9)
    expect(iframe.style.height).toBe('')
  })

  it('ignores submits received before the mount guard elapses', () => {
    const submitText = vi.fn()

    renderWidget(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }), submitText)
    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement

    act(() => vi.advanceTimersByTime(499))
    sendWidgetMessage(iframe, { lotus: 1, text: 'auto-fired', type: 'submit' })

    expect(submitText).not.toHaveBeenCalled()
  })

  it('renders a bridge-unavailable hint and drops submits without a provider', () => {
    renderWidget(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }))

    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')

    expect(screen.getByText(/submit-back is unavailable/i)).not.toBeNull()

    act(() => vi.advanceTimersByTime(500))
    sendWidgetMessage(iframe, { lotus: 1, text: 'dropped', type: 'submit' })

    expect(postMessage).not.toHaveBeenCalled()
  })

  it('rejects submit text over 16 KB', () => {
    const submitText = vi.fn()

    renderWidget(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }), submitText)
    const iframe = screen.getByTitle('Lotus widget') as HTMLIFrameElement
    const postMessage = vi.spyOn(iframe.contentWindow!, 'postMessage')

    act(() => vi.advanceTimersByTime(500))
    sendWidgetMessage(iframe, { lotus: 1, text: 'x'.repeat(16_385), type: 'submit' })

    expect(submitText).not.toHaveBeenCalled()
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('renders the fallback when inline HTML exceeds 256 KB', () => {
    renderWidget(JSON.stringify({ html: 'x'.repeat(256 * 1024 + 1) }))

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.queryByTitle('Lotus widget')).toBeNull()
  })

  it('renders the fallback while streaming', () => {
    render(<WidgetRenderer code={JSON.stringify({ html: '<p>partial</p>' })} fallback={fallback} streaming />)

    expect(screen.getByTestId('fallback')).not.toBeNull()
    expect(screen.queryByTitle('Lotus widget')).toBeNull()
  })

  it('uses aspect ratio instead of fixed height when provided', () => {
    renderWidget(JSON.stringify({ aspectRatio: 16 / 9, height: 900, html: '<p>ratio</p>' }))

    expect(Number.parseFloat((screen.getByTitle('Lotus widget') as HTMLIFrameElement).style.aspectRatio)).toBeCloseTo(
      16 / 9
    )
  })

  it('registers widget as the canonical fence while preserving the applet alias', () => {
    expect(RICH_FENCE_LANGUAGES.has('widget')).toBe(true)
    expect(RICH_FENCE_LANGUAGES.has('applet')).toBe(true)
  })

  it('allows URL mode only for HTTP localhost and grants same-origin in its sandbox', () => {
    renderWidget(JSON.stringify({ url: 'http://localhost:2600/widgets/test' }))

    const iframe = screen.getByTitle('Lotus widget')

    expect(iframe.getAttribute('src')).toBe('http://localhost:2600/widgets/test')
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts allow-forms allow-same-origin')
  })

  it('delegates MIDI to URL-mode widgets so a keyboard can reach them', () => {
    renderWidget(JSON.stringify({ url: 'http://localhost:2600/widgets/midi-rhythm?atom=PIA-01' }))

    expect(screen.getByTitle('Lotus widget').getAttribute('allow')).toBe('midi')
  })

  it('does not delegate MIDI to null-origin inline HTML widgets', () => {
    renderWidget(JSON.stringify({ html: '<!doctype html><button>Submit</button>' }))

    expect(screen.getByTitle('Lotus widget').getAttribute('allow')).toBeNull()
  })
})
