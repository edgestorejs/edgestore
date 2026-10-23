---
'@edgestore/server': patch
---

Harden the `edgestore-ctx` context cookie against cross-site requests.

- The context cookie now defaults to `SameSite=Lax` and `HttpOnly`, and to
  `Secure` when `NODE_ENV` is `production`. Plain HTTP `localhost` development
  keeps working. Options set in `cookieConfig.ctx.options` still take
  precedence: an app that serves production over plain HTTP can set
  `secure: false`, and an app that calls the EdgeStore API from a different
  site can set `sameSite: 'none'` and `secure: true`.
- Requests with a body must now be sent with `Content-Type: application/json`,
  as `@edgestore/react` already does. Other content types get a `400` response.
- The encrypted context now expires after `cookieConfig.ctx.options.maxAge`
  instead of always after 30 days, so a shorter `maxAge` also limits how long
  an outdated context stays valid.
