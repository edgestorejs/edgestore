---
'@edgestore/react': major
'@edgestore/server': major
'@edgestore/shared': major
'@edgestore/sdk': minor
'@edgestore/cli': minor
---

Publish the EdgeStore packages as ESM-only packages and require Node.js 22.22.0 or
newer. Emit NodeNext-compatible declaration imports, and upgrade the server
runtime dependencies to `cookie` 2 and `jose` 6.

The SDK and CLI share this runtime minimum. Repository builds and release tooling
continue to require Node.js 24 or newer.
