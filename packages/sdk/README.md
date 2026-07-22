# @edgestore/sdk

Official low-level TypeScript SDK for the EdgeStore API.

The SDK is server-only and uses EdgeStore API v2. Generated OpenAPI types stay
internal while the package exposes a stable, resource-oriented public API.

Operation and field documentation is generated from the pinned OpenAPI schema;
SDK-specific behavior is documented on the handwritten public facade.

```ts
import { createEdgeStoreSdk } from '@edgestore/sdk';

const sdk = createEdgeStoreSdk({
  credentials: {
    accessKey: process.env.EDGE_STORE_ACCESS_KEY!,
    secretKey: process.env.EDGE_STORE_SECRET_KEY!,
  },
});

const result = await sdk.runtime.uploads.upload({
  bucket: 'documents',
  source: pdfBlob,
  fileName: 'invoice.pdf',
  metadata: { invoiceId: 'invoice-123' },
  signal,
  onProgress: ({ percentage, phase }) => console.log(phase, percentage),
});
```

Project credentials expose runtime resources for their current project.
Management tokens expose management resources and runtime calls with an
explicit `project` selector.

The high-level upload helper supports automatic multipart selection, bounded
parallelism, retries, progress, abort signals, cancellation, and processing
polling. Lower-level upload lifecycle methods are also available.

See the [EdgeStore documentation](https://edgestore.dev/docs/sdk) for runtime,
management, error-handling, and custom transport examples.
