# @edgestore/sdk

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
