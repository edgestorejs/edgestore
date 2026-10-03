# @edgestore/shared

## 1.0.0-rc.7

### Minor Changes

- [#275](https://github.com/edgestorejs/edgestore/pull/275) [`e1548ab`](https://github.com/edgestorejs/edgestore/commit/e1548abcc37b195a697e9b13689bb88bb7cf4d5c) Thanks [@raviships](https://github.com/raviships)! - React upload results include the file `id` when the provider exposes one, so
  apps can save it without a lookup. Uploads still resolve after the transfer;
  pass `options.waitForProcessing` to resolve with the processed file instead,
  and use `onPhaseChange` to show when processing starts. Processing failures
  reject with `UploadCanceledError`, and waits longer than `timeoutMs` reject
  with `UploadProcessingTimeoutError`. Waiting never confirms a temporary file.

  Providers can report processing state with `uploads.getStatus`. The EdgeStore
  provider implements it, and the new `/upload-status` route only answers for
  the browser that requested the upload.

## 1.0.0-rc.6

### Major Changes

- [#262](https://github.com/edgestorejs/edgestore/pull/262) [`371b083`](https://github.com/edgestorejs/edgestore/commit/371b0834f7006f3c3245ae2f46aac6bd9fa3dbff) Thanks [@raviships](https://github.com/raviships)! - Bring the Azure Blob provider to parity with S3. Large browser uploads use
  block uploads with signed, object-scoped sessions: the browser stages blocks
  through short-lived Put Block URLs, and the provider checks every block's size
  before committing to catch incomplete uploads. Backend uploads are available through the router client,
  files can be referenced by `{ key }` as well as by URL, and uploads accept a
  `path` callback and `objectOptions` (cache control, content disposition, and
  metadata).

  Breaking changes to `azureBlob()`: `customBaseUrl` / `ES_AZURE_BASE_URL` is
  replaced by `endpoint` / `ES_AZURE_ENDPOINT`, with a separate `baseUrl` for file
  URLs. Credentials are checked on first use instead of when the provider is
  created. Upload responses include a signed read URL only when the private
  bucket sets `autoSignedUrls`, and cookie-based access-control rules are
  rejected at initialization.

  Multipart part ETags are optional in the provider contract, so storage that
  returns none can complete uploads. S3 and the hosted provider reject missing
  ETags with an actionable error.

### Patch Changes

- [#264](https://github.com/edgestorejs/edgestore/pull/264) [`4df0909`](https://github.com/edgestorejs/edgestore/commit/4df090990f42a069da0e19e37a06bee1c1af499e) Thanks [@raviships](https://github.com/raviships)! - Begin the v1 release-candidate cycle under the `rc` tag.

## 1.0.0-next.5

## 1.0.0-next.4

### Minor Changes

- [#237](https://github.com/edgestorejs/edgestore/pull/237) [`9dfc9fe`](https://github.com/edgestorejs/edgestore/commit/9dfc9fe8cea705a03d51d8a0fec39f3fb6189467) Thanks [@raviships](https://github.com/raviships)! - Discover project file origins from the service and initialize protected access on both project and preserved legacy hosts. Existing service responses and explicit development base URL overrides remain supported. Upload calls and file references are unchanged.

  Allow management project creation to opt into project subdomains with `useProjectDomain: true`. Omitting the option preserves shared-domain compatibility with older packages.

## 1.0.0-next.3

## 1.0.0-next.2

### Major Changes

- [#151](https://github.com/edgestorejs/edgestore/pull/151) [`57027e8`](https://github.com/edgestorejs/edgestore/commit/57027e8112ec138353c4863c55cd703d1b55e485) Thanks [@perfectbase](https://github.com/perfectbase)! - Remove the Zod peer dependency. Applications can install any Standard
  Schema-compatible validation library for bucket input.

- [#151](https://github.com/edgestorejs/edgestore/pull/151) [`7737d73`](https://github.com/edgestorejs/edgestore/commit/7737d73d10c9bb28d49e56a5593ebd259ba1fb8e) Thanks [@perfectbase](https://github.com/perfectbase)! - Accept Standard Schema-compatible bucket input schemas and infer client input
  separately from the validated output provided to server callbacks.

## 1.0.0-next.1

### Major Changes

- [#194](https://github.com/edgestorejs/edgestore/pull/194) [`6933267`](https://github.com/edgestorejs/edgestore/commit/6933267367ac8d3090578195afbddfe3cd6569ba) Thanks [@perfectbase](https://github.com/perfectbase)! - Redesign providers, HTTP handlers, and the router-derived backend client for
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

## 1.0.0-next.0

### Major Changes

- [#159](https://github.com/edgestorejs/edgestore/pull/159) [`cb42a68`](https://github.com/edgestorejs/edgestore/commit/cb42a684d2a194bf77de9a2af8cdec1f4ac72f1f) Thanks [@perfectbase](https://github.com/perfectbase)! - Publish the EdgeStore packages as ESM-only packages and require Node.js 24 or
  newer. Emit NodeNext-compatible declaration imports, and upgrade the server
  runtime dependencies to `cookie` 2 and `jose` 6.

## 0.8.0

### Minor Changes

- [#112](https://github.com/edgestorejs/edgestore/pull/112) [`8f66ade`](https://github.com/edgestorejs/edgestore/commit/8f66adeae1963fc23823d1a5ef048cff64a38b57) Thanks [@perfectbase](https://github.com/perfectbase)! - Add upload transformers for client and backend uploads.

- [#118](https://github.com/edgestorejs/edgestore/pull/118) [`9809264`](https://github.com/edgestorejs/edgestore/commit/98092643574ad666c273ed824f19d433843ffdb5) Thanks [@perfectbase](https://github.com/perfectbase)! - Add private bucket access control, backend signed URL helpers, and schema-controlled auto-signed upload responses.

### Patch Changes

- [#136](https://github.com/edgestorejs/edgestore/pull/136) [`c40d5a7`](https://github.com/edgestorejs/edgestore/commit/c40d5a7e104c8c4ecf75bf57aff81cc3f095c978) Thanks [@perfectbase](https://github.com/perfectbase)! - Present concise, user-friendly types for public EdgeStore APIs in editor hovers.

- [#115](https://github.com/edgestorejs/edgestore/pull/115) [`7a3d7fc`](https://github.com/edgestorejs/edgestore/commit/7a3d7fc5c18459403ec67ff817b965934a692105) Thanks [@perfectbase](https://github.com/perfectbase)! - Avoid unnecessary EdgeStore file-access token initialization when EdgeStore buckets do not need a private-file access cookie.

## 0.7.0

## 0.7.0-canary.2

## 0.7.0-canary.1

## 0.7.0-canary.0

## 0.6.0

### Minor Changes

- [#98](https://github.com/edgestorejs/edgestore/pull/98) [`c5db53e`](https://github.com/edgestorejs/edgestore/commit/c5db53e1ed5b6359a8f32062969e870026054a1c) Thanks [@perfectbase](https://github.com/perfectbase)! - Upgrade rollup and release flow

## 0.6.0-canary.3

### Minor Changes

- Upgrade rollup and release flow

## 0.5.8-canary.0

### Patch Changes

- [`20da2cb`](https://github.com/edgestorejs/edgestore/commit/20da2cb1dd7c3163a3fb1031c68818647f537819) Thanks [@perfectbase](https://github.com/perfectbase)! - Update internal release flow
