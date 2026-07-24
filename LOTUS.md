# Lotus

Lotus is a personal fork of Hermes Desktop for small, focused desktop experiments. Its first fork feature is an in-chat widget renderer with a submit-back bridge into the live chat session.

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

`widget` is the canonical fence. The old `applet` fence remains a compatibility alias so existing transcripts still render.

Inline HTML runs in a sandbox without same-origin access. URL widgets are limited to HTTP URLs hosted on `localhost` or `127.0.0.1`; bridge messages must keep the exact origin declared in the fence, so redirects or in-frame navigation to remote sites lose access.

The descriptor's `height` is the initial frame height. Widgets fit their full content without an inner scrollbar by reporting document height whenever it changes:

```js
window.parent.postMessage(
  { lotus: 1, type: 'resize', height: document.documentElement.scrollHeight },
  '*'
)
```

Lotus accepts trusted finite heights from 160 through 8192 px. Widgets with an explicit `aspectRatio` stay fixed.

To submit a result as a real user turn in the same session, the widget posts:

```js
window.parent.postMessage(
  {
    lotus: 1,
    type: 'submit',
    text: 'Widget completed. Continue from this result.'
  },
  '*'
)
```

### Protocol v1

| field | required | meaning |
|---|---|---|
| `lotus` | yes | protocol version, must be `1` |
| `type` | yes | `"submit"`, `"notify"`, or `"resize"` |
| `text` | for submit | user-turn text, at most 16 KB |
| `title` | optional | short notification label |
| `height` | for resize | finite document height in CSS pixels; host clamps to 160–8192 |

After accepting a submit, the host posts `{lotus: 1, type: "ack", ok: true}` back to the widget.

## Widget design default

Every new widget uses shadcn/ui unless the user requests another visual system. shadcn/ui supplies open component code and semantic theme tokens, not a package that the sandbox can import by assumption. Inline HTML stays self-contained; reusable Etude widgets compose the shared component layer in `~/dev/etude/widgets/shadcn.css`.

The default visual character is the shadcn dark dashboard system: near-black canvas, charcoal cards, subtle borders, generous radii, pill controls, restrained type, neutral primary actions, and sparse semantic color. Widgets should size to their full content without nested scrolling.

## Run the desktop app

```bash
npm install
cd apps/desktop
npm run dev
```

## Rebase policy

Fork commits stay on `main` above upstream `main`. Keep the fork surface small and edge-shaped, and periodically rebase it onto fresh upstream so conflicts remain inexpensive.
