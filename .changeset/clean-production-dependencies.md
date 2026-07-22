---
'@edgestore/react': patch
'@edgestore/server': patch
---

Remove unused server-side dependencies from the React client and refresh the
server's cookie and token dependencies. UUID generation now uses the platform
crypto API.
