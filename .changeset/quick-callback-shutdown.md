---
'@edgestore/cli': patch
---

Close lingering browser connections when browser login finishes so the CLI can
exit promptly after receiving the OAuth callback.
