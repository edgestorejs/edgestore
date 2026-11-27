---
'@edgestore/server': patch
'@edgestore/react': patch
---

Security: remove the `/proxy-file` route. It forwarded the visitor's cookies to
any URL given in its `url` query parameter and served the response from the
app's origin, in every environment and without authentication. A crafted link
could leak session cookies, run attacker-controlled HTML on the app's origin, or
make the server fetch internal URLs.

Protected files now load directly from their file URL in development as well.
The React `disableDevProxy` option and the backend client `baseUrl` option are
no longer used and are deprecated. Upgrade `@edgestore/server` and
`@edgestore/react` together.
