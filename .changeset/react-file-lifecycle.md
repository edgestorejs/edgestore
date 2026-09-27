---
'@edgestore/react': major
---

pr: #194

Rename the React `confirmUpload` method to `confirm`, and add `confirmMany` and
`deleteMany`, which report per-file failures. Frontend deletion runs
`beforeDelete` for every file before deleting any of them. Upload results
include the object `key` when the provider exposes one.
