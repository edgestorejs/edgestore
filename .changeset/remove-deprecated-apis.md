---
'@edgestore/server': major
'@edgestore/react': major
---

Remove deprecated and duplicate entrypoints and options:
`@edgestore/react/shared` (import errors from `@edgestore/react/errors`),
`@edgestore/server/core` (import types from `@edgestore/server`), the
`InferClientResponse` type (use `InferClientOutputs`), and the S3
`accessKeyId` and `secretAccessKey` options (pass `credentials` or set
`ES_AWS_ACCESS_KEY_ID` and `ES_AWS_SECRET_ACCESS_KEY`).
