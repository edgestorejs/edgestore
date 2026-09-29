---
'@edgestore/react': minor
---

pr: #275

React upload results include the file `id` and object `key` when the provider
exposes them, so apps can store a stable reference without a lookup.
