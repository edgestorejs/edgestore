---
'@edgestore/server': major
'@edgestore/react': major
'@edgestore/shared': major
---

pr: #151

Accept any Standard Schema library for bucket `input`, and drop the Zod peer
dependency. The server now validates upload input, rejects invalid requests
with `BAD_REQUEST`, and passes the parsed output to callbacks.
