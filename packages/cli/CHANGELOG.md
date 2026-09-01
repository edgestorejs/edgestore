# @edgestore/cli

## 1.0.0-next.4

### Minor Changes

- [#233](https://github.com/edgestorejs/edgestore/pull/233) [`89555c5`](https://github.com/edgestorejs/edgestore/commit/89555c5c9f97a192be2a3612cb1bbbe1e5129e7c) Thanks [@raviships](https://github.com/raviships)! - Upload up to three files concurrently and report all file-level failures after
  the active batch settles.

### Patch Changes

- [#233](https://github.com/edgestorejs/edgestore/pull/233) [`cd209e0`](https://github.com/edgestorejs/edgestore/commit/cd209e0036bad76bf8c59f8e19f9c468ef947de7) Thanks [@raviships](https://github.com/raviships)! - Report byte-level upload transfer progress and render stable, in-place upload
  rows in interactive terminals instead of appending one line for every update.
- Updated dependencies [[`cd209e0`](https://github.com/edgestorejs/edgestore/commit/cd209e0036bad76bf8c59f8e19f9c468ef947de7)]:
  - @edgestore/sdk@1.0.0-next.4

## 1.0.0-next.3

### Minor Changes

- [#231](https://github.com/edgestorejs/edgestore/pull/231) [`30a07ce`](https://github.com/edgestorejs/edgestore/commit/30a07ce36cf6368ea46ca288b69002c58a2fc465) Thanks [@perfectbase](https://github.com/perfectbase)! - Add OAuth device-code login for callback-free and remote terminal sessions.

### Patch Changes

- Updated dependencies []:
  - @edgestore/sdk@1.0.0-next.3

## 1.0.0-next.2

### Minor Changes

- [#168](https://github.com/edgestorejs/edgestore/pull/168) [`3e669a1`](https://github.com/edgestorejs/edgestore/commit/3e669a102a2b75f30e36d17ac23454200332f247) Thanks [@perfectbase](https://github.com/perfectbase)! - Add the EdgeStore CLI for account and project administration, one-time key and
  management-token workflows, bucket and file operations, uploads, guided
  initialization, browser OAuth with automatic refresh and revocation, dashboard
  links, shell completion, and diagnostics.

  Add high-level management uploads to the SDK with transfer retries, multipart
  ETag validation, Retry-After-aware processing polling, and automatic cleanup.

### Patch Changes

- Updated dependencies [[`a944263`](https://github.com/edgestorejs/edgestore/commit/a944263d329a5f0f6df2f408038fb7015e0a750f), [`3e669a1`](https://github.com/edgestorejs/edgestore/commit/3e669a102a2b75f30e36d17ac23454200332f247)]:
  - @edgestore/sdk@1.0.0-next.2
