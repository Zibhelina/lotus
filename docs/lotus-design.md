# Lotus — fork design

Lotus is a personal fork of Hermes Desktop. It is not Etude-specific: it is a general place to modify the desktop app. Its first feature is **in-chat widgets with a submit-back bridge**, which Etude and other local tools can use.

Branch model: `main` carries the small Lotus commit stack on top of upstream `main`. Remotes: `origin` (Zibhelina/lotus), `hermes-local` (the local Hermes runtime checkout), and `upstream` (NousResearch/hermes-agent). Rebase periodically and keep the fork surface edge-shaped.

## Feature 1: chat widgets + session submit bridge

### Canonical surface

The agent renders a widget inside an assistant message with a fenced block:

~~~
```widget
{"url": "http://127.0.0.1:2600/widgets/flashcard-drill?queue=german-w3", "height": 480}
```
~~~

or self-contained inline HTML:

~~~
```widget
{"height": 360, "html": "<!DOCTYPE html><html>…self-contained…</html>"}
```
~~~

`widget` is canonical. `applet` is a renderer alias retained only for old transcripts.

### Frame sizing

The sandbox may report its document height so Lotus grows the outer frame instead of showing a nested scrollbar:

```js
window.parent.postMessage({lotus: 1, type: "resize", height: document.documentElement.scrollHeight}, "*")
```

The host accepts finite heights from 160 through 8192 px. The descriptor's `height` remains the initial fallback. An explicit `aspectRatio` disables auto-resize.

### Submit-back

When the user finishes an interaction, the widget can send its result into the same chat session as a real user turn:

```js
window.parent.postMessage({
  lotus: 1,
  type: "submit",
  text: "Etude widget submitted GER-01 (inbox ref 3). Grade it."
}, "*")
```

The host validates the envelope and routes the text through the same submit path as the composer. Queueing, steering, optimistic UI, and session targeting remain intact.

### Security and fallback

- Inline HTML sandbox: `allow-scripts allow-forms`, without same-origin access.
- URL mode: HTTP on `localhost` or `127.0.0.1` only; bridge messages must retain the descriptor's exact origin.
- Web MIDI: URL widgets get `allow="midi"` on the frame, and Electron's permission handlers grant it. **Both gates must open** — the frame policy alone leaves `requestMIDIAccess` rejected, which reads as a browser bug rather than a permission denial. Inline HTML is deliberately excluded: its null origin cannot hold the permission. Note that Chromium raises this as **`midiSysex`** even for `requestMIDIAccess({sysex: false})`, so a handler matching only `'midi'` silently denies ordinary note input; both names must be accepted. The page still asks for `sysex: false`, so no sysex capability is granted.
- Source check: `event.source` must equal the widget iframe's `contentWindow`.
- Submit payload: at most 16 KB, ignored during the first 500 ms, and debounced to one every 2 seconds.
- Resize payload: finite and clamped to 160–8192 px.
- Streaming, invalid JSON, missing source, oversized HTML, or invalid URLs fall back to the normal code block.

### Widget design default

Every new widget uses shadcn/ui unless the user asks for another style. shadcn/ui is open component code and semantic tokens, not a package Lotus can assume inside a sandbox. Inline widgets must be self-contained. Reusable Etude widgets use `widgets/shadcn.css` and semantic theme tokens.

Default appearance follows a restrained shadcn dark dashboard: near-black background, charcoal cards, subtle one-pixel borders, large radii, pill controls, neutral primary actions, sparse status color, and no normal nested scrollbars.

### Files owned by the fork

```text
apps/desktop/src/components/assistant-ui/embeds/widget-embed.tsx
apps/desktop/src/components/assistant-ui/embeds/widget-embed.test.tsx
apps/desktop/src/components/assistant-ui/embeds/widget-bridge-context.ts
apps/desktop/src/components/assistant-ui/embeds/registry.tsx
apps/desktop/src/app/contrib/wiring.tsx
LOTUS.md
docs/lotus-design.md
```

## Protocol v1

| field | required | meaning |
|---|---|---|
| `lotus` | yes | protocol version, must be `1` |
| `type` | yes | `"submit"`, `"notify"`, or `"resize"` |
| `text` | for submit | user-turn text, at most 16 KB |
| `title` | optional | short notification label |
| `height` | for resize | finite document height in CSS pixels; host clamps to 160–8192 |

After a successful submit, the host posts `{lotus: 1, type: "ack", ok: true}` back to the widget.

## Verification

- Focused widget tests pass.
- All three TypeScript configurations pass.
- Full Desktop tests and build pass before packaging.
- Installed-app E2E verifies a real `widget` fence, content resize, and submit-back.
- The legacy `applet` fence remains covered by a compatibility test.
