/**
 * Show-thinking — render the assistant's reasoning trace in the thread.
 *
 * A device-local preference (each computer keeps its own), on by default so the
 * app behaves as before unless the user opts out. Reasoning is often the
 * longest part of a transcript and pushes the actual answer off screen; turning
 * it off drops the "Thinking" disclosures without touching the model request,
 * so reasoning still happens — it just is not shown.
 *
 * Renderer-only: nothing in the main process cares.
 */

import { atom } from 'nanostores'

import { persistBoolean, storedBoolean } from '@/lib/storage'

const KEY = 'lotus.desktop.showThinking.v1'

export const $showThinking = atom<boolean>(typeof window === 'undefined' ? true : storedBoolean(KEY, true))

export function setShowThinking(on: boolean): void {
  $showThinking.set(on)
}

if (typeof window !== 'undefined') {
  $showThinking.subscribe(on => {
    persistBoolean(KEY, on)
  })
}
