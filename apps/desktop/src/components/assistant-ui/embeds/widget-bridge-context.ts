'use client'

import { createContext } from 'react'

export interface WidgetBridge {
  submitText: (text: string) => void
}

export const WidgetBridgeContext = createContext<WidgetBridge | null>(null)
