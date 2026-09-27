---
'@edgestore/server': major
---

pr: #249

Add S3 multipart uploads for large files, backend uploads, private buckets
with signed downloads, and per-object settings (cache and download headers,
metadata, tags, storage class, and encryption). The `overwritePath` option is
replaced by `path`, which returns a key relative to the router bucket. S3 does
not support `temporary` or `replaceTargetUrl`, and rejects cookie-based
`accessControl` rules at initialization.
