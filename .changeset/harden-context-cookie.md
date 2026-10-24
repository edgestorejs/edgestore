---
'@edgestore/server': patch
---

Harden the `edgestore-ctx` cookie against cross-site requests.

- The cookie now defaults to `SameSite=Lax` and `HttpOnly`, and to `Secure`
  when `NODE_ENV` is `production`. `cookieConfig.ctx.options` still overrides
  each default; a frontend on a different site needs `sameSite: 'none'` and
  `secure: true`.
- Requests with a body must use `Content-Type: application/json`, as
  `@edgestore/react` already does. Other content types get a `400`.
- The encrypted context now expires with the cookie's `maxAge` instead of
  always after 30 days.
