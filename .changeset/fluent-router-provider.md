---
'@edgestore/server': major
'@edgestore/shared': major
---

Let server routers configure their provider and expose their backend client directly. Use `es.router(buckets)` with the hosted EdgeStore provider by default, or chain `.provider(provider)` to return a new router with provider-specific client methods. All HTTP adapters now accept `{ router }`, and development proxy options can be passed as the second argument to `es.router`.

Default provider and backend client initialization is deferred until needed. Import `initEdgeStore` from `@edgestore/server`; the shared package now contains bucket primitives and cross-package types without a second initializer. Public backend client type helpers infer the selected provider directly from the router.
