---
"@edgestore/react": patch
"@edgestore/server": patch
"@edgestore/shared": patch
---

Avoid unnecessary EdgeStore file-access token initialization for providers and buckets that do not need a private-file access cookie.
