---
"@edgestore/sdk": major
---

Add the complete v2 upload workflow, including text, byte, blob, stream, and
remote URL sources; multipart uploads; retries; progress phases; and processing
polling. File mutation failures use the same `EdgeStoreFileMutationError`
runtime class as the router-derived backend client. Runtime signed reads use
`files.generateSignedReadUrls`, while management callers use
`files.generateAccessUrls` and receive `accessUrls`.
