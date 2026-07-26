---
"@edgestore/server": major
"@edgestore/shared": major
---

Redesign the router-derived backend client around explicit provider capabilities,
canonical API v2 file records, ID/key/URL references, flat cursor pagination,
async iteration, and singular or partial-result batch lifecycle methods. Router
context is now a flat map of string values (with optional properties) so hooks,
path and metadata builders, and provider access tokens share one contract.
Concrete providers now determine which backend methods exist and the file,
reference, cursor, mutation, and signed-URL types returned by those methods.
`EdgeStoreFileMutationError` is shared with `@edgestore/sdk` and exposes the
failed reference as `fileRef`.

Configure the router and provider once with `createEdgeStore`. HTTP adapters now
accept that configured instance, and the hosted `edgestore()` provider exposes
its router-derived backend client as `edgeStore.client`. Providers use the
`EdgeStoreProvider` contract; the direct-storage factories and entrypoints are
renamed to `s3()` from `providers/s3` and `azureBlob()` from
`providers/azure-blob`.
