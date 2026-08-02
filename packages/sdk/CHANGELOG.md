# @edgestore/sdk

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
