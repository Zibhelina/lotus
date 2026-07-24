# Lotus

Lotus is a personal fork of Hermes Desktop for small, focused desktop experiments. Its first fork feature is an in-chat applet renderer with a submit-back bridge into the live chat session.

## Chat applets

An assistant message can embed a local web applet:

~~~markdown
```applet
{"url":"http://127.0.0.1:2600/applets/flashcard-drill","height":480}
```
~~~

Or self-contained inline HTML:

~~~markdown
```applet
{"height":360,"html":"<!doctype html><html><body>...</body></html>"}
```
~~~

Inline HTML runs in a sandbox without same-origin access. URL applets are limited to HTTP URLs hosted on `localhost` or `127.0.0.1`; bridge messages must keep the exact origin declared in the fence, so redirects or in-frame navigation to remote sites lose access.

The descriptor's `height` is the initial/fallback frame height. Applets can fit their full content without an inner scrollbar by reporting their document height whenever it changes:

```js
window.parent.postMessage(
  { lotus: 1, type: 'resize', height: document.documentElement.scrollHeight },
  '*'
)
```

Lotus accepts trusted finite heights from 160 through 8192 px. Applets with an explicit `aspectRatio` stay fixed.

To submit a result as a real user turn in the same session, the applet posts:

```js
window.parent.postMessage(
  {
    lotus: 1,
    type: 'submit',
    text: 'Applet completed. Continue from this result.'
  },
  '*'
)
```

### Protocol v1

| field | required | meaning |
|---|---|---|
| `lotus` | yes | protocol version, must be `1` |
| `type` | yes | `"submit"` (user turn), `"notify"` (toast only), or `"resize"` (fit frame to content) |
| `text` | for submit | the user-turn text, ≤16 KB |
| `title` | optional | short label for the toast/confirmation |
| `height` | for resize | finite document height in CSS pixels; host clamps to 160–8192 |

After accepting a submit, the host posts `{lotus: 1, type: "ack", ok: true}` back to the applet.

## Run the desktop app

```bash
npm install
cd apps/desktop
npm run dev
```

## Rebase policy

Fork commits stay on `lotus-main` above upstream `main`. Keep the fork surface small and edge-shaped, and periodically rebase it onto a fresh upstream branch so conflicts remain inexpensive.
