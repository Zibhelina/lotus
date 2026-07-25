import { beforeEach, describe, expect, it } from 'vitest'

import { $showThinking, setShowThinking } from './show-thinking'

const KEY = 'lotus.desktop.showThinking.v1'

describe('show-thinking preference', () => {
  beforeEach(() => {
    setShowThinking(true)
  })

  it('defaults to showing reasoning so the app behaves as before unless opted out', () => {
    expect($showThinking.get()).toBe(true)
  })

  it('persists the choice so a relaunch keeps reasoning hidden', () => {
    setShowThinking(false)

    expect($showThinking.get()).toBe(false)
    expect(window.localStorage.getItem(KEY)).toBe('false')

    setShowThinking(true)
    expect(window.localStorage.getItem(KEY)).toBe('true')
  })
})
