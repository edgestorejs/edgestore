# @edgestore/shared

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
