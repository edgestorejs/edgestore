---
'@edgestore/react': minor
'@edgestore/server': minor
---

pr: #256

Make long browser multipart uploads resilient: part URLs are signed in batches,
failed parts are retried with backoff, and failed or canceled uploads abort the
multipart session.
