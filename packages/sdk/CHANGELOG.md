# @edgestore/sdk

## 1.0.0-next.4

### Minor Changes

- [#237](https://github.com/edgestorejs/edgestore/pull/237) [`9dfc9fe`](https://github.com/edgestorejs/edgestore/commit/9dfc9fe8cea705a03d51d8a0fec39f3fb6189467) Thanks [@raviships](https://github.com/raviships)! - Discover project file origins from the service and initialize protected access on both project and preserved legacy hosts. Existing service responses and explicit development base URL overrides remain supported. Upload calls and file references are unchanged.

  Allow management project creation to opt into project subdomains with `useProjectDomain: true`. Omitting the option preserves shared-domain compatibility with older packages.

- [#237](https://github.com/edgestorejs/edgestore/pull/237) [`cee2e96`](https://github.com/edgestorejs/edgestore/commit/cee2e961d404959fb7adfddaa9c0ab74dbd7f88e) Thanks [@raviships](https://github.com/raviships)! - Allow the EdgeStore provider to pass router bucket settings to managed uploads, so the first backend upload can create a bucket with the correct visibility.

### Patch Changes

- [#233](https://github.com/edgestorejs/edgestore/pull/233) [`cd209e0`](https://github.com/edgestorejs/edgestore/commit/cd209e0036bad76bf8c59f8e19f9c468ef947de7) Thanks [@raviships](https://github.com/raviships)! - Report byte-level upload transfer progress and render stable, in-place upload
  rows in interactive terminals instead of appending one line for every update.

## 1.0.0-next.3

## 1.0.0-next.2

### Minor Changes

- [#168](https://github.com/edgestorejs/edgestore/pull/168) [`3e669a1`](https://github.com/edgestorejs/edgestore/commit/3e669a102a2b75f30e36d17ac23454200332f247) Thanks [@perfectbase](https://github.com/perfectbase)! - Add the EdgeStore CLI for account and project administration, one-time key and
  management-token workflows, bucket and file operations, uploads, guided
  initialization, browser OAuth with automatic refresh and revocation, dashboard
  links, shell completion, and diagnostics.

  Add high-level management uploads to the SDK with transfer retries, multipart
  ETag validation, Retry-After-aware processing polling, and automatic cleanup.

### Patch Changes

- [#213](https://github.com/edgestorejs/edgestore/pull/213) [`a944263`](https://github.com/edgestorejs/edgestore/commit/a944263d329a5f0f6df2f408038fb7015e0a750f) Thanks [@perfectbase](https://github.com/perfectbase)! - Update the pinned API v2 contract with OAuth user principals and the latest
  management token scopes and presets.

## 1.0.0-next.1

### Major Changes

- [#194](https://github.com/edgestorejs/edgestore/pull/194) [`6933267`](https://github.com/edgestorejs/edgestore/commit/6933267367ac8d3090578195afbddfe3cd6569ba) Thanks [@perfectbase](https://github.com/perfectbase)! - Introduce the supported, server-only EdgeStore API v2 SDK. The SDK exposes
  resource-oriented runtime, management, and system clients; project and Bearer
  credentials; explicit management project scoping; cursor pagination; typed
  errors; and a complete upload workflow for local, streaming, multipart, and
  remote URL sources. A public multipart planner applies the same upload
  thresholds, part sizing, and limits across SDK and provider integrations. Its
  public documentation is derived from the pinned OpenAPI contract, and the
  published package includes its TypeScript sources for editor navigation.
