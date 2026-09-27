---
'@edgestore/server': major
---

Support automatic S3 multipart uploads with signed sessions scoped to one
object, backend uploads, private signed downloads, stable key references, and
configurable object settings (cache and download headers, metadata, tags,
storage class, and encryption). Browser uploads receive the exact headers S3
signs. Multipart sessions sign their first part URLs up front, refresh the rest
on demand, and last `multipart.sessionExpiresIn` (24 hours by default). Backend
multipart uploads send parts concurrently through the configured S3 client,
and file deletion uses batched `DeleteObjects` requests.

S3 declares `temporary` and `replaceTargetUrl` as unsupported, so the upload
types omit them and EdgeStore rejects them at runtime. Cookie-based access
control rules are rejected at initialization instead of being silently
ignored.
