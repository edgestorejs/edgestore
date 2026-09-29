---
'@edgestore/server': major
'@edgestore/shared': major
---

pr: #194

Replace the custom provider interface with the `EdgeStoreProvider` contract and
the `defineProvider` helper. The backend client only exposes the operations a
provider implements.
