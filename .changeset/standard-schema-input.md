---
'@edgestore/server': major
'@edgestore/react': major
'@edgestore/shared': major
---

pr: #151

Accept any Standard Schema-compatible library for bucket `input`, and drop the
Zod peer dependency. The server now validates upload input before
`beforeUpload`, path, and metadata callbacks, rejects invalid input, and passes
the parsed output to those callbacks.
