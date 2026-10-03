---
'@edgestore/server': major
---

pr: #249

Replace the S3 `overwritePath` option with `path`, which returns a key relative
to the router bucket. S3 rejects `temporary`, `replaceTargetUrl`, and
cookie-based `accessControl` rules instead of ignoring them.
