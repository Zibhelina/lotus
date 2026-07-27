# Lotus

**A personal fork of [Hermes Desktop](https://github.com/NousResearch/hermes-agent).**

Lotus is my own version of the Hermes Agent desktop app — modified freely around my taste in UI and the capabilities I want. It staysrebased on top of upstream so every Hermes update flows in, while keeping a small set of fork-owned features above it.

This repo contains the full Hermes Agent codebase. The desktop app lives in `apps/desktop/`. The fork surface is intentionally small and edge-shaped so periodic rebases onto upstream stay clean.

## What Lotus changes

- **Chat widgets** — assistant messages can embed interactive widgets (URL-served or inline HTML) that render inline and submit results back into the live chat session as a real user turn. The `widget` fence is the canonical form; `applet` remains as a compatibility alias.
- **Web MIDI delegation** — URL-mode widgets can reach MIDI keyboards via `allow="midi"` on the frame and Electron permission handlers.
- **Brand and identity** — Lotus has its own name, dock icon, wordmark, bundle ID (`com.zibhelina.lotus`), and fork-aware update root that tracks this repo rather than upstream.
- **Hide thinking trace** — a setting to collapse the reasoning/thinking block in the chat UI.
- **Model catalog additions** — newly released models surfaced before the upstream runtime learns them.

## Chat widgets

An assistant message can embed a local widget:

~~~markdown
```widget
{"url":"http://127.0.0.1:2600/widgets/flashcard-drill","height":480}
```
~~~

Or self-contained inline HTML:

~~~markdown
```widget
{"height":360,"html":"<!doctype html><html><body>...</body></html>"}
```
~~~

Inline HTML runs in a sandbox without same-origin access. URL widgets are limited to HTTP on `localhost` or `127.0.0.1`. The bridge protocol is documented in [`docs/lotus-design.md`](docs/lotus-design.md).

### Protocol v1

| field | required | meaning |
|---|---|---|
| `lotus` | yes | protocol version, must be `1` |
| `type` | yes | `"submit"`, `"notify"`, or `"resize"` |
| `text` | for submit | user-turn text, at most 16 KB |
| `title` | optional | short notification label |
| `height` | for resize | finite document height in CSS px; clamped to 160–8192 |

```js
// Submit a result back into the chat session
window.parent.postMessage(
  { lotus: 1, type: 'submit', text: 'Widget completed.' },
  '*'
)

// Auto-size to content height
window.parent.postMessage(
  { lotus: 1, type: 'resize', height: document.documentElement.scrollHeight },
  '*'
)
```

## Run from source

```bash
git clone https://github.com/Zibhelina/lotus.git
cd lotus
npm install
cd apps/desktop
npm run dev
```

Lotus connects to a running Hermes Agent gateway on `localhost:8642`.

## Relationship to upstream

Lotus is not a rewrite. It is a short stack of commits on top of fresh `upstream/main`, periodically rebased forward. Everything Hermes does, Lotus does — plus the features above.

- **Upstream:** [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)
- **Hermes docs:** [hermes-agent.nousresearch.com](https://hermes-agent.nousresearch.com/docs/)
- **License:** MIT (inherited from upstream)
