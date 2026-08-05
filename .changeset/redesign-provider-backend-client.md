---
"@edgestore/server": major
"@edgestore/shared": major
"@edgestore/react": major
---

Redesign providers, HTTP handlers, and the router-derived backend client for
EdgeStore API v2. Configure a router and provider once with `createEdgeStore`,
pass the resulting instance to adapters through `edgestore`, and access its
eagerly created, type-safe backend client through `.client`.

Providers now use the resource-oriented `EdgeStoreProvider` contract and the
public `defineProvider` helper. File references, cursors, capabilities, inputs,
and results are inferred from each provider definition, and unsupported
backend methods remain absent. Provider `get` and `list` operations can return
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

Framework adapters now delegate routing, cookies, proxying, response
normalization, and error formatting to a shared dispatcher. Provider browser
initialization is capability-driven rather than selected by provider name.
The S3 provider reserves the router bucket as the first key segment, and Azure
Blob Storage generates short-lived blob-scoped upload and read credentials.
