---
"@edgestore/server": major
"@edgestore/shared": major
"@edgestore/react": major
---

Redesign the router-derived backend client around explicit provider capabilities,
canonical API v2 file records, ID/key/URL references, explicit cursor pagination,
and singular or partial-result batch lifecycle methods. Router
context is now a flat map of string values (with optional properties) so hooks,
path and metadata builders, and provider access tokens share one contract.
Concrete providers now determine which backend methods exist and the file,
reference, cursor, mutation, and signed-URL types returned by those methods.
Backend-capable providers are structurally checked at configuration time,
including cursor and mutation-reference consistency, while unsupported
capabilities remain absent from the derived client. Frontend file lookup,
confirmation, and deletion now preserve the selected bucket through the
provider boundary so router authorization cannot be applied to one bucket and
then mutate a file from another. The unused adapter-level `getSignedUrls`
overlap is removed; `getSignedUrls` now belongs exclusively to backend
capabilities.
`EdgeStoreFileMutationError` is shared with `@edgestore/sdk` and exposes the
failed reference as `fileRef`.

Configure the router and provider once with `createEdgeStore`. HTTP adapters now
accept that configured instance through the `edgestore` option, and the
configured instance exposes its router-derived backend client as
`configuredEdgeStore.client`. Providers use the
`EdgeStoreProvider` contract; the direct-storage factories and entrypoints are
renamed to `s3()` from `providers/s3` and `azureBlob()` from
`providers/azure-blob`.

Custom and official providers now use the public `defineProvider` API. File
references and list cursors are inferred from Standard Schema definitions and
validated before provider operations run. A single resource-oriented provider
surface supplies both HTTP handlers and the router-derived backend client, so
providers no longer repeat handler-specific get, confirm, delete, or list
methods. Multipart upload support is one optional `uploads.multipart`
capability; single-part providers omit it entirely. Provider batch mutations
return one ordered status per input while EdgeStore attaches references and
derives counts. The S3 provider reserves the logical router bucket as the first
object-key segment and replaces `overwritePath` with a `path` callback that
customizes everything beneath that boundary. S3 access URLs percent-encode
object-key segments so keys containing URL delimiters, percent signs, spaces,
or Unicode round-trip through lookup and deletion.

Provider initialization is now context-safe and provider-neutral. `init`
receives the router's flat context type and may return an explicit
`clientInit` instruction when the browser must initialize provider-side state.
The React provider follows that instruction against the provider's returned
base URL instead of selecting behavior through `provider.name`.

All HTTP adapters now delegate EdgeStore route dispatch, response
normalization, cookie handling, proxy behavior, and error formatting to one
framework-neutral dispatcher. Framework adapters only translate their native
request and response primitives, and handler logging no longer depends on
process-global state.

The React client now exposes `confirm`, `confirmMany`, `delete`, and
`deleteMany`. The router-derived backend client uses the same resource-scoped
pattern with `get`, `list`, `listAll`, lifecycle methods with `Many` suffixes,
and `createSignedUrl` / `createSignedUrls`. Batch mutations use one request and
preserve per-file storage failures. Frontend deletion authorizes every file through
`beforeDelete` before issuing one provider batch mutation; if any file is
unauthorized, none are deleted.

Frontend route bodies and bucket inputs are validated before hooks or providers
run, and the encrypted context cookie namespaces application values under
`ctx`. Azure Blob Storage now uses a server-side account key to generate
short-lived blob-scoped upload/read SAS URLs instead of exposing a reusable SAS
credential. Provider read results preserve their actual path and metadata
types; uploads expose the values computed by the router.
