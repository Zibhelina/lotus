# Lilypad

Lilypad is a personal fork of Hermes Desktop for small, focused desktop experiments. Its first fork feature is an in-chat applet renderer with a submit-back bridge into the live chat session.

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

Inline HTML runs in a sandbox without same-origin access. URL applets are limited to HTTP URLs hosted on `localhost` or `127.0.0.1`.

To submit a result as a real user turn in the same session, the applet posts:

```js
window.parent.postMessage(
  {
    lilypad: 1,
    type: 'submit',
    text: 'Applet completed. Continue from this result.'
  },
  '*'
)
```

### Protocol v1

| field | required | meaning |
|---|---|---|
| `lilypad` | yes | protocol version, must be `1` |
| `type` | yes | `"submit"` (user turn) or `"notify"` (toast only, no turn) |
| `text` | for submit | the user-turn text, ≤16 KB |
| `title` | optional | short label for the toast/confirmation |

After accepting a submit, the host posts `{lilypad: 1, type: "ack", ok: true}` back to the applet.

## Run the desktop app

```bash
npm install
cd apps/desktop
npm run dev
```

## Rebase policy

Fork commits stay on `lilypad-main` above upstream `main`. Keep the fork surface small and edge-shaped, and periodically rebase it onto a fresh upstream branch so conflicts remain inexpensive.
