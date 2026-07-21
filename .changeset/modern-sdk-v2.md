---
"@edgestore/sdk": major
"@edgestore/server": major
"@edgestore/shared": major
---

Add the supported EdgeStore API v2 SDK and migrate the hosted provider and
router-derived backend client to it. The backend client now uses cursor
pagination, normalizes nullish metadata, and supports provider-driven multipart
uploads. Remove the handcrafted API v1 server client.
