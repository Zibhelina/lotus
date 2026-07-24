import type { ReactNode } from 'react'

// Shared prop contract for fenced-block renderers (applet, mermaid, svg). Kept in its
// own module so renderers and the registry can both import it without a cycle.
export interface RichFenceProps {
  code: string
  /** The normal syntax-highlighted block, used when a rich renderer cannot
   * safely render its input. */
  fallback?: ReactNode
  /** True while the surrounding message is still streaming. Renderers that can
   *  throw on partial input (e.g. mermaid) defer until this is false. */
  streaming?: boolean
}
