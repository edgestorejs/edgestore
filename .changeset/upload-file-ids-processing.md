---
'@edgestore/react': minor
'@edgestore/server': minor
'@edgestore/shared': minor
---

pr: #275

React upload results include the file `id` when the provider exposes one, so
apps can save it without a lookup. Uploads still resolve after the transfer;
pass `options.waitForProcessing` to resolve with the processed file instead,
and use `onPhaseChange` to show when processing starts. Processing failures
reject with `UploadCanceledError`, and waits longer than `timeoutMs` reject
with `UploadProcessingTimeoutError`. Waiting never confirms a temporary file.

Providers can report processing state with `uploads.getStatus`. The EdgeStore
provider implements it, and the new `/upload-status` route only answers for
the browser that requested the upload.
