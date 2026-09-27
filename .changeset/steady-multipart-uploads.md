---
'@edgestore/react': minor
'@edgestore/server': minor
'@edgestore/shared': minor
---

Make browser multipart uploads resilient for long transfers. Providers sign
only the first part URLs, and the browser requests the rest in batches as it
reaches them, refreshing a rejected URL once. Transient part failures (network
errors, throttling, server errors, and S3 request timeouts) are retried with
jittered exponential backoff, while permanent failures stop the upload
promptly. Failed and canceled uploads stop queued and active parts and abort
the multipart session through the new `abort-multipart-upload` route, with a
five-second cleanup deadline.

Single-part upload plans can return `uploadHeaders` for the browser to send,
and upload responses include the object `key` when the provider exposes one.
Providers can declare unsupported upload options with
`uploads.supportedOptions`; the browser and backend upload types omit them and
EdgeStore rejects them at runtime.
