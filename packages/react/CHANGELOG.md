# @edgestore/react

## 1.0.0

### Major Changes

- [#159](https://github.com/edgestorejs/edgestore/pull/159) [`bd89793`](https://github.com/edgestorejs/edgestore/commit/bd89793834f7a8e2185fe97c82c6e842c4d3ba2b) Thanks [@raviships](https://github.com/raviships)! - Publish ESM-only packages and require Node.js 22.22.0 or newer.
  `@edgestore/react` no longer installs server-only dependencies.

- [#194](https://github.com/edgestorejs/edgestore/pull/194) [`1bd3452`](https://github.com/edgestorejs/edgestore/commit/1bd34529d998283595aa09bd808817a67ef5a166) Thanks [@raviships](https://github.com/raviships)! - Rename the React `confirmUpload` method to `confirm`.

- [#263](https://github.com/edgestorejs/edgestore/pull/263) [`ed81242`](https://github.com/edgestorejs/edgestore/commit/ed812425ad7451c600115356f6c0849d8321e61a) Thanks [@raviships](https://github.com/raviships)! - React `confirm` and `delete` throw `EdgeStoreFileMutationError` with the
  failure code, matching the backend client.

- [#263](https://github.com/edgestorejs/edgestore/pull/263) [`ed81242`](https://github.com/edgestorejs/edgestore/commit/ed812425ad7451c600115356f6c0849d8321e61a) Thanks [@raviships](https://github.com/raviships)! - Remove `uploadedAt` from React upload results. It reported the request time,
  not the upload time.

- [#263](https://github.com/edgestorejs/edgestore/pull/263) [`ed81242`](https://github.com/edgestorejs/edgestore/commit/ed812425ad7451c600115356f6c0849d8321e61a) Thanks [@raviships](https://github.com/raviships)! - Remove deprecated and duplicate APIs: `@edgestore/react/shared` (use
  `@edgestore/react/errors`), `@edgestore/server/core` (use `@edgestore/server`),
  `InferClientResponse` (use `InferClientOutputs`), and the S3 `accessKeyId` and
  `secretAccessKey` options (use `credentials` or the `ES_AWS_*` variables).

- [#255](https://github.com/edgestorejs/edgestore/pull/255) [`7a66d4c`](https://github.com/edgestorejs/edgestore/commit/7a66d4c6f7bec480ad3be7951c5f54d2e9cbd845) Thanks [@raviships](https://github.com/raviships)! - Load protected files directly from their file origin in development. The
  `/proxy-file` route and the React `disableDevProxy` option are removed.
  Adapters no longer set the `edgestore-token` cookie, so `cookieConfig.token` is
  removed.

- [#151](https://github.com/edgestorejs/edgestore/pull/151) [`7c8a7b6`](https://github.com/edgestorejs/edgestore/commit/7c8a7b6e9146360edb4003120238f37f5ea91e92) Thanks [@raviships](https://github.com/raviships)! - Accept any Standard Schema library for bucket `input`, and drop the Zod peer
  dependency. The server now validates upload input, rejects invalid requests
  with `BAD_REQUEST`, and passes the parsed output to callbacks.

### Minor Changes

- [#248](https://github.com/edgestorejs/edgestore/pull/248) [`ae605b9`](https://github.com/edgestorejs/edgestore/commit/ae605b99a25bdd11e276d00184c9baeedcdbb1cf) Thanks [@raviships](https://github.com/raviships)! - Bundle Markdown API references that match the installed version, for coding
  agents.

- [#237](https://github.com/edgestorejs/edgestore/pull/237) [`31405ca`](https://github.com/edgestorejs/edgestore/commit/31405ca9ffa25d9f953a22aaf89f0287da5e9bc5) Thanks [@raviships](https://github.com/raviships)! - Initialize protected file access on the file origins returned by EdgeStore,
  including project subdomains and the shared origin used by existing links.

- [#194](https://github.com/edgestorejs/edgestore/pull/194) [`1bd3452`](https://github.com/edgestorejs/edgestore/commit/1bd34529d998283595aa09bd808817a67ef5a166) Thanks [@raviships](https://github.com/raviships)! - Add React `confirmMany` and `deleteMany`, which report per-file failures
  instead of throwing.

- [#256](https://github.com/edgestorejs/edgestore/pull/256) [`017f324`](https://github.com/edgestorejs/edgestore/commit/017f3249fb3f1e062b8080668da22e30db293689) Thanks [@raviships](https://github.com/raviships)! - Make long browser multipart uploads resilient: part URLs are signed in batches,
  failed parts are retried with backoff, and failed or canceled uploads abort the
  multipart session.

- [#275](https://github.com/edgestorejs/edgestore/pull/275) [`e1548ab`](https://github.com/edgestorejs/edgestore/commit/e1548abcc37b195a697e9b13689bb88bb7cf4d5c) Thanks [@raviships](https://github.com/raviships)! - Pass `options.waitForProcessing` to resolve an upload with the processed file,
  and `onPhaseChange` to show when processing starts. Failures and timeouts reject
  with `UploadCanceledError` and `UploadProcessingTimeoutError`. Providers opt in
  by implementing `uploads.getStatus`.

- [#275](https://github.com/edgestorejs/edgestore/pull/275) [`e1548ab`](https://github.com/edgestorejs/edgestore/commit/e1548abcc37b195a697e9b13689bb88bb7cf4d5c) Thanks [@raviships](https://github.com/raviships)! - React upload results include the file `id` when the provider exposes one, so
  apps can store it without a lookup.

- [#256](https://github.com/edgestorejs/edgestore/pull/256) [`017f324`](https://github.com/edgestorejs/edgestore/commit/017f3249fb3f1e062b8080668da22e30db293689) Thanks [@raviships](https://github.com/raviships)! - React upload results include the object `key` when the provider exposes one.

### Patch Changes

- Updated dependencies [[`fc16f0a`](https://github.com/edgestorejs/edgestore/commit/fc16f0af18564c83c8dd2c601386a0054534de76), [`fc16f0a`](https://github.com/edgestorejs/edgestore/commit/fc16f0af18564c83c8dd2c601386a0054534de76), [`fc16f0a`](https://github.com/edgestorejs/edgestore/commit/fc16f0af18564c83c8dd2c601386a0054534de76), [`f822286`](https://github.com/edgestorejs/edgestore/commit/f82228612a7b803549169dea03b18b59b1f63ae7)]:
  - @edgestore/shared@1.0.0

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

### Patch Changes

- Updated dependencies [[`6462d06`](https://github.com/edgestorejs/edgestore/commit/6462d0651da79d935b21b30e63c4f4b5158a7320)]:
  - @edgestore/shared@1.0.0-rc.7

## 1.0.0-rc.6

### Major Changes

- [#263](https://github.com/edgestorejs/edgestore/pull/263) [`6b46893`](https://github.com/edgestorejs/edgestore/commit/6b46893343e8c8641a574d8e2f35d841a793d54b) Thanks [@raviships](https://github.com/raviships)! - Remove deprecated and duplicate entrypoints and options:
  `@edgestore/react/shared` (import errors from `@edgestore/react/errors`),
  `@edgestore/server/core` (import types from `@edgestore/server`), the
  `InferClientResponse` type (use `InferClientOutputs`), and the S3
  `accessKeyId` and `secretAccessKey` options (pass `credentials` or set
  `ES_AWS_ACCESS_KEY_ID` and `ES_AWS_SECRET_ACCESS_KEY`).

### Patch Changes

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

- [#264](https://github.com/edgestorejs/edgestore/pull/264) [`4df0909`](https://github.com/edgestorejs/edgestore/commit/4df090990f42a069da0e19e37a06bee1c1af499e) Thanks [@raviships](https://github.com/raviships)! - Begin the v1 release-candidate cycle under the `rc` tag.

- Updated dependencies [[`371b083`](https://github.com/edgestorejs/edgestore/commit/371b0834f7006f3c3245ae2f46aac6bd9fa3dbff), [`4df0909`](https://github.com/edgestorejs/edgestore/commit/4df090990f42a069da0e19e37a06bee1c1af499e)]:
  - @edgestore/shared@1.0.0-rc.6

## 1.0.0-next.5

### Patch Changes

- Updated dependencies []:
  - @edgestore/shared@1.0.0-next.5

## 1.0.0-next.4

### Minor Changes

- [#248](https://github.com/edgestorejs/edgestore/pull/248) [`7061756`](https://github.com/edgestorejs/edgestore/commit/7061756406e16388663c445ab6fc1472b72bf5e2) Thanks [@raviships](https://github.com/raviships)! - Add coding-agent setup for Codex, Claude Code, and Cursor, including skill
  installation and updates, hosted MCP configuration, application context, and
  offline diagnostics. Automated provisioning delivers credentials to protected
  files instead of returning secrets in structured output.

  Bundle version-matched Markdown API references with the server, React, and SDK
  packages so agents can use documentation for the application's installed versions.

- [#237](https://github.com/edgestorejs/edgestore/pull/237) [`9dfc9fe`](https://github.com/edgestorejs/edgestore/commit/9dfc9fe8cea705a03d51d8a0fec39f3fb6189467) Thanks [@raviships](https://github.com/raviships)! - Discover project file origins from the service and initialize protected access on both project and preserved legacy hosts. Existing service responses and explicit development base URL overrides remain supported. Upload calls and file references are unchanged.

  Allow management project creation to opt into project subdomains with `useProjectDomain: true`. Omitting the option preserves shared-domain compatibility with older packages.

### Patch Changes

- Updated dependencies [[`9dfc9fe`](https://github.com/edgestorejs/edgestore/commit/9dfc9fe8cea705a03d51d8a0fec39f3fb6189467)]:
  - @edgestore/shared@1.0.0-next.4

## 1.0.0-next.3

### Patch Changes

- Updated dependencies []:
  - @edgestore/shared@1.0.0-next.3

## 1.0.0-next.2

### Major Changes

- [#151](https://github.com/edgestorejs/edgestore/pull/151) [`57027e8`](https://github.com/edgestorejs/edgestore/commit/57027e8112ec138353c4863c55cd703d1b55e485) Thanks [@perfectbase](https://github.com/perfectbase)! - Remove the Zod peer dependency. Applications can install any Standard
  Schema-compatible validation library for bucket input.

- [#151](https://github.com/edgestorejs/edgestore/pull/151) [`7737d73`](https://github.com/edgestorejs/edgestore/commit/7737d73d10c9bb28d49e56a5593ebd259ba1fb8e) Thanks [@perfectbase](https://github.com/perfectbase)! - Accept Standard Schema-compatible bucket input schemas and infer client input
  separately from the validated output provided to server callbacks.

### Patch Changes

- Updated dependencies [[`57027e8`](https://github.com/edgestorejs/edgestore/commit/57027e8112ec138353c4863c55cd703d1b55e485), [`7737d73`](https://github.com/edgestorejs/edgestore/commit/7737d73d10c9bb28d49e56a5593ebd259ba1fb8e)]:
  - @edgestore/shared@1.0.0-next.2

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

### Patch Changes

- Updated dependencies [[`6933267`](https://github.com/edgestorejs/edgestore/commit/6933267367ac8d3090578195afbddfe3cd6569ba)]:
  - @edgestore/shared@1.0.0-next.1

## 1.0.0-next.0

### Major Changes

- [#159](https://github.com/edgestorejs/edgestore/pull/159) [`cb42a68`](https://github.com/edgestorejs/edgestore/commit/cb42a684d2a194bf77de9a2af8cdec1f4ac72f1f) Thanks [@perfectbase](https://github.com/perfectbase)! - Publish the EdgeStore packages as ESM-only packages and require Node.js 24 or
  newer. Emit NodeNext-compatible declaration imports, and upgrade the server
  runtime dependencies to `cookie` 2 and `jose` 6.

### Patch Changes

- [#148](https://github.com/edgestorejs/edgestore/pull/148) [`29ff3f5`](https://github.com/edgestorejs/edgestore/commit/29ff3f5394a513bc1c5b6c2aa7b8944e74d9f453) Thanks [@perfectbase](https://github.com/perfectbase)! - Remove unused server-side dependencies from the React client and refresh the
  server's cookie and token dependencies. UUID generation now uses the platform
  crypto API.
- Updated dependencies [[`cb42a68`](https://github.com/edgestorejs/edgestore/commit/cb42a684d2a194bf77de9a2af8cdec1f4ac72f1f)]:
  - @edgestore/shared@1.0.0-next.0

## 0.8.0

### Minor Changes

- [#112](https://github.com/edgestorejs/edgestore/pull/112) [`8f66ade`](https://github.com/edgestorejs/edgestore/commit/8f66adeae1963fc23823d1a5ef048cff64a38b57) Thanks [@perfectbase](https://github.com/perfectbase)! - Add upload transformers for client and backend uploads.

- [#118](https://github.com/edgestorejs/edgestore/pull/118) [`9809264`](https://github.com/edgestorejs/edgestore/commit/98092643574ad666c273ed824f19d433843ffdb5) Thanks [@perfectbase](https://github.com/perfectbase)! - Add private bucket access control, backend signed URL helpers, and schema-controlled auto-signed upload responses.

### Patch Changes

- [#136](https://github.com/edgestorejs/edgestore/pull/136) [`c40d5a7`](https://github.com/edgestorejs/edgestore/commit/c40d5a7e104c8c4ecf75bf57aff81cc3f095c978) Thanks [@perfectbase](https://github.com/perfectbase)! - Present concise, user-friendly types for public EdgeStore APIs in editor hovers.

- [#115](https://github.com/edgestorejs/edgestore/pull/115) [`7a3d7fc`](https://github.com/edgestorejs/edgestore/commit/7a3d7fc5c18459403ec67ff817b965934a692105) Thanks [@perfectbase](https://github.com/perfectbase)! - Avoid unnecessary EdgeStore file-access token initialization when EdgeStore buckets do not need a private-file access cookie.

- Updated dependencies [[`c40d5a7`](https://github.com/edgestorejs/edgestore/commit/c40d5a7e104c8c4ecf75bf57aff81cc3f095c978), [`8f66ade`](https://github.com/edgestorejs/edgestore/commit/8f66adeae1963fc23823d1a5ef048cff64a38b57), [`7a3d7fc`](https://github.com/edgestorejs/edgestore/commit/7a3d7fc5c18459403ec67ff817b965934a692105), [`9809264`](https://github.com/edgestorejs/edgestore/commit/98092643574ad666c273ed824f19d433843ffdb5)]:
  - @edgestore/shared@0.8.0

## 0.7.0

### Patch Changes

- [`2708b80`](https://github.com/edgestorejs/edgestore/commit/2708b804e1adc70bf894c7ff528b4325e0f720e0) Thanks [@perfectbase](https://github.com/perfectbase)! - Improved upload error handling

- Updated dependencies []:
  - @edgestore/shared@0.7.0

## 0.7.0-canary.2

### Patch Changes

- [`2708b80`](https://github.com/edgestorejs/edgestore/commit/2708b804e1adc70bf894c7ff528b4325e0f720e0) Thanks [@perfectbase](https://github.com/perfectbase)! - Improved upload error handling

- Updated dependencies []:
  - @edgestore/shared@0.7.0-canary.2

## 0.7.0-canary.1

### Patch Changes

- Updated dependencies []:
  - @edgestore/shared@0.7.0-canary.1

## 0.7.0-canary.0

### Patch Changes

- Updated dependencies []:
  - @edgestore/shared@0.7.0-canary.0

## 0.6.0

### Minor Changes

- [#98](https://github.com/edgestorejs/edgestore/pull/98) [`c5db53e`](https://github.com/edgestorejs/edgestore/commit/c5db53e1ed5b6359a8f32062969e870026054a1c) Thanks [@perfectbase](https://github.com/perfectbase)! - Upgrade rollup and release flow

### Patch Changes

- Updated dependencies [[`c5db53e`](https://github.com/edgestorejs/edgestore/commit/c5db53e1ed5b6359a8f32062969e870026054a1c)]:
  - @edgestore/shared@0.6.0

## 0.6.0-canary.3

### Minor Changes

- Upgrade rollup and release flow

## 0.5.8-canary.0

### Patch Changes

- [`20da2cb`](https://github.com/edgestorejs/edgestore/commit/20da2cb1dd7c3163a3fb1031c68818647f537819) Thanks [@perfectbase](https://github.com/perfectbase)! - Update internal release flow

- Updated dependencies [[`20da2cb`](https://github.com/edgestorejs/edgestore/commit/20da2cb1dd7c3163a3fb1031c68818647f537819)]:
  - @edgestore/shared@0.5.8-canary.0
