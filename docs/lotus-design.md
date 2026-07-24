# Lotus — fork design

Lotus is a personal fork of Hermes Desktop. Not an etude-specific fork: a general place to modify the desktop app freely. Its first feature is **in-chat applets with a submit-back bridge**, which etude (and anything else) can use.

Branch model: `lotus-main` carries fork commits on top of upstream `main`. Remotes: `hermes-local` (the local hermes-agent checkout, for fast rebases), `upstream` (GitHub). Rebase fork commits onto fresh upstream periodically; keep the fork surface SMALL and edge-shaped so rebases stay cheap.

## Feature 1: chat applets + session submit bridge

### What it does

1. The agent can render an interactive applet inside a chat message using a fenced code block:

   ~~~
   ```applet
   {"url": "http://127.0.0.1:2600/applets/flashcard-drill?queue=german-w3", "height": 480}
   ```
   ~~~

   or inline HTML:

   ~~~
   ```applet
   {"height": 360, "html": "<!DOCTYPE html><html>…self-contained…</html>"}
   ```
   ~~~

2. The applet runs in a sandboxed iframe. It may report its document height so Lotus grows the frame instead of showing a nested scrollbar:

   ```js
   window.parent.postMessage({lotus: 1, type: "resize", height: document.documentElement.scrollHeight}, "*")
   ```

   The host accepts trusted finite heights from 160 through 8192 px. The fence's `height` remains the initial/fallback size. Explicit `aspectRatio` applets stay fixed.

3. When the user finishes an interaction, the applet can send its result back **into the same chat session as a real user turn** via `postMessage`:

   ```js
   window.parent.postMessage({
     lotus: 1,                       // protocol version
     type: "submit",                   // "submit" = create a user turn
     text: "Etude applet submitted GER-01 (inbox ref 3). Grade it."
   }, "*")
   ```

4. The host validates the envelope and routes `text` through the SAME submit path the composer uses (optimistic UI, queueing, steering when the agent is streaming — all preserved). If a turn is already streaming, the text enters the normal steering/queue flow, exactly as if typed.

### Design constraints (from the app's engineering guide)

- **Edge, not waist.** The renderer is a lazy chunk in the existing `RichCodeBlock` fence registry (`registry.tsx`), exactly like `mermaid`/`svg`. No new global store, no new core surface.
- **Renderer owns presentation; backend owns sessions.** The bridge does NOT call gateway RPC directly. It hands text to the already-wired composer submit callback (`usePromptActions`), which owns session targeting, resume, queue, and optimistic paint.
- **Security:** iframe `sandbox="allow-scripts allow-forms"` (NO `allow-same-origin` for inline HTML; URL mode may include it only for HTTP localhost URLs). Bridge accepts only messages whose `event.source` is that iframe's `contentWindow`, with `lotus: 1` and a known `type`. URL applets must also match the exact origin declared in the fence, so a redirect or in-frame navigation to a remote site loses bridge access. Submit text is capped at 16 KB; resize heights are finite and clamped to 160–8192 px. One submit per applet per 2s (debounce); ignore everything else.
- **No auto-fire:** a `submit` requires a user gesture inside the applet (the applet's own button); the host additionally ignores submits arriving <500ms after mount.
- **Streaming-safe:** fence content arrives progressively; render the applet only when the fence is complete (the registry's `streaming` prop is false), showing the plain code block meanwhile — same behavior as mermaid.
- **Fallback:** invalid JSON, missing url/html, or oversized html (256 KB cap) → render the normal syntax-highlighted block (the `fallback` prop).

### Files (fork-owned)

```
apps/desktop/src/components/assistant-ui/embeds/applet-embed.tsx   # NEW: renderer + bridge
apps/desktop/src/components/assistant-ui/embeds/applet-embed.test.tsx  # NEW
apps/desktop/src/components/assistant-ui/embeds/registry.tsx       # +1 line: applet entry
<one small wiring point>  # expose the composer submit callback to the embed layer
                          # via a narrow context/store — see Wiring below
LOTUS.md                                                         # fork README (root)
```

### Wiring the submit callback

The embed renderers live deep under the assistant-ui message tree with no access to `usePromptActions`. Add ONE narrow seam: a React context (`AppletBridgeContext`) that carries `{ submitText(text: string): void; sessionKey: string }`, provided at the chat-view level where `usePromptActions` is already in scope, consumed by `applet-embed.tsx`. When no provider is present (e.g. renderer used outside a live chat), the applet still renders but submits are disabled with a visible hint — degrade, don't crash.

### Protocol v1 (documented in LOTUS.md)

| field | required | meaning |
|---|---|---|
| `lotus` | yes | protocol version, must be `1` |
| `type` | yes | `"submit"` (user turn), `"notify"` (toast only), or `"resize"` (fit frame to content) |
| `text` | for submit | the user-turn text, ≤16 KB |
| `title` | optional | short label for the toast/confirmation |
| `height` | for resize | finite document height in CSS pixels; host clamps to 160–8192 |

Host → applet: after a successful submit the host posts back `{lotus: 1, type: "ack", ok: true}` to the iframe so the applet can show "sent".

## Verification

- `npm run typecheck` clean (all three tsconfigs).
- `vitest run` — existing suites untouched + new applet tests green.
- Manual: `npm run dev`, paste an assistant message with an `applet` fence (or drive a real agent turn), interact, verify the submit lands as a user turn in the transcript and reaches the agent.
