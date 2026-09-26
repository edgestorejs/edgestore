---
'@edgestore/server': minor
---

Let server routers configure their provider and expose their backend client directly. Use `es.router(buckets)` with the hosted EdgeStore provider by default, or chain `.provider(provider)` to return a new router with provider-specific client methods. All HTTP adapters now accept `{ router }`, and development proxy options can be passed as the second argument to `es.router`.

Default provider and backend client initialization is deferred until needed. Existing `createEdgeStore` and `{ edgestore }` handler configurations remain supported.
