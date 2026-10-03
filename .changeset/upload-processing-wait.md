---
'@edgestore/react': minor
'@edgestore/server': minor
'@edgestore/shared': minor
---

pr: #275

Pass `options.waitForProcessing` to resolve an upload with the processed file,
and `onPhaseChange` to show when processing starts. Failures and timeouts reject
with `UploadCanceledError` and `UploadProcessingTimeoutError`. Providers opt in
by implementing `uploads.getStatus`.
