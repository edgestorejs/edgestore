---
'@edgestore/server': major
'@edgestore/react': major
---

pr: #255

Load protected files directly from their file origin in development. The
`/proxy-file` route and the React `disableDevProxy` option are removed.
Adapters no longer set the `edgestore-token` cookie, so `cookieConfig.token` is
removed.
