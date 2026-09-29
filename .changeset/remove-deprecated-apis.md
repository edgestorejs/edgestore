---
'@edgestore/server': major
'@edgestore/react': major
---

pr: #263

Remove deprecated and duplicate APIs: `@edgestore/react/shared` (use
`@edgestore/react/errors`), `@edgestore/server/core` (use `@edgestore/server`),
`InferClientResponse` (use `InferClientOutputs`), and the S3 `accessKeyId` and
`secretAccessKey` options (use `credentials` or the `ES_AWS_*` variables).
