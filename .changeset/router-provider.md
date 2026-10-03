---
'@edgestore/server': major
---

pr: #253

Configure the provider once with `es.router({ ... }).provider(...)` and pass
only the `router` to adapters. Use `router.client` in place of
`initEdgeStoreClient`.
