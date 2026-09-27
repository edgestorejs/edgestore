---
'@edgestore/server': major
---

pr: #194

Rebuild the backend client on EdgeStore API v2. Methods are `upload`, `get`,
`list`, `confirm`, `delete`, `restore`, their `Many` batch variants, and
`createSignedUrl(s)`. Files are referenced by `{ id }`, `{ key }`, or `{ url }`,
and results are canonical file records. `list` takes `{ cursor, limit }` and
returns `items`. Batch methods report per-file failures, and singular methods
throw `EdgeStoreFileMutationError`. Methods the provider does not support are
absent from the client. `InferClientOutputs` replaces `InferClientResponse`.
