---
'@edgestore/server': patch
---

pr: #263

Respond with `401 UNAUTHORIZED` instead of a server error when the
`edgestore-ctx` cookie is expired, tampered with, or encrypted with a different
secret.
