---
"@edgestore/server": major
"@edgestore/shared": major
"@edgestore/react": major
---

Redesign providers, HTTP handlers, and the router-derived backend client for
EdgeStore API v2. Configure the router with `es.router(...)`, optionally chain
`.provider(...)`, and pass it to adapters through `router`. Access its lazily
created, type-safe backend client through `router.client`.

Import the single `initEdgeStore` initializer from `@edgestore/server`; shared
contains bucket primitives and cross-package types. Routers use the hosted
provider by default, and `.provider(...)` returns a new router without changing
existing handlers or clients. Each router caches its provider and backend
client. Protected files load directly from their file origin in development,
so the `/proxy-file` route, development proxy URLs, and the React
`disableDevProxy` option are removed. Adapters no longer set the
`edgestore-token` cookie on the application domain, so `cookieConfig.token` and
the provider `init` result's `token` are removed; file origins receive the token
through `clientInit` headers.
Public backend client type helpers infer the selected provider directly from
the router without a second provider generic.

Providers now use the resource-oriented `EdgeStoreProvider` contract and the
public `defineProvider` helper. File references, cursors, capabilities, inputs,
and results are inferred from each provider definition, and unsupported
backend methods remain absent. Multipart providers implement `requestParts`,
`complete`, and `abort` over the same `{ uploadId, key }` session. Provider `get` and `list` operations can return
router path and metadata fields independently; their presence and optionality
are reflected in the generated backend client. The hosted `edgestore()`
provider uses the new API v2 SDK and supports project credentials or a Bearer
token with an explicit project. Direct storage providers are exposed as `s3()`
and `azureBlob()`.

Backend and React lifecycle methods use singular names with `Many` batch
variants. Batch mutations preserve per-file failures, frontend deletion
authorizes every file before mutating storage, and file operations remain
scoped to the selected router bucket. Router context is a flat map of optional
string values shared by hooks, path and metadata builders, and provider
initialization.

Framework adapters now delegate routing, cookies, response normalization,
and error formatting to a shared dispatcher. Provider browser
initialization is capability-driven rather than selected by provider name.
The S3 provider reserves the router bucket as the first key segment, and Azure
Blob Storage generates short-lived blob-scoped upload and read credentials.

Make browser multipart uploads resilient for long transfers. Providers sign
only the first part URLs, and the browser requests the rest in batches as it
reaches them, refreshing a rejected URL once. Transient part failures (network
errors, throttling, server errors, and S3 request timeouts) are retried with
jittered exponential backoff, while permanent failures stop the upload
promptly. Failed and canceled uploads stop queued and active parts and abort
the multipart session through the new `abort-multipart-upload` route, with a
five-second cleanup deadline.

Single-part upload plans can return `uploadHeaders` for the browser to send,
and upload responses include the object `key` when the provider exposes one.
Providers can declare unsupported upload options with
`uploads.supportedOptions`; the browser and backend upload types omit them and
EdgeStore rejects them at runtime. The S3 and Azure Blob providers declare
`temporary` and `replaceTargetUrl` as unsupported.
