---
'@edgestore/react': major
---

pr: #194

Rename the React `confirmUpload` method to `confirm`, and add `confirmMany` and
`deleteMany`, which report per-file failures. `confirm` and `delete` throw
`EdgeStoreFileMutationError` with the failure code. Frontend deletion runs
`beforeDelete` for every file before deleting any of them. Upload results
include the object `key` when the provider exposes one, and no longer include
`uploadedAt`, which reported the request time.
