---
'@edgestore/server': major
'@edgestore/shared': major
---

pr: #194

Replace the custom provider interface with the `EdgeStoreProvider` contract and
the `defineProvider` helper. File references, cursors, and results are inferred
from the provider definition, and the backend client only exposes operations
the provider implements. Upload plans return the file `url` and an optional
`signedReadUrl`, and `init` can return `clientInit.urls` for the browser to
request before loading protected files. Providers can declare upload options
they do not support, which are then rejected by the types and at runtime.
