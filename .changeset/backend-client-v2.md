---
'@edgestore/server': major
---

pr: #194

Rebuild the backend client on EdgeStore API v2. Methods are renamed (`get`,
`list`, `confirm`, `delete`, `restore`, their `Many` variants, and
`createSignedUrl(s)`), files are referenced by `{ id }`, `{ key }`, or
`{ url }`, and `list` uses cursor pagination. Singular methods throw
`EdgeStoreFileMutationError`, and batch methods report per-file failures.
