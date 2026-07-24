'use client'

import { createContext } from 'react'

export interface AppletBridge {
  submitText: (text: string) => void
}

export const AppletBridgeContext = createContext<AppletBridge | null>(null)
