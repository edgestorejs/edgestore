---
'@edgestore/react': minor
'@edgestore/server': minor
---

pr: #256

Make browser multipart uploads resilient on long transfers. Part URLs are
signed in batches as the upload reaches them, transient part failures are
retried with backoff, and failed or canceled uploads abort the multipart
session.
