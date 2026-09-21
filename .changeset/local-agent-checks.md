---
'@edgestore/cli': minor
---

Add `doctor --offline` to check package compatibility, env files, router imports,
adapter/provider setup, legacy options, and CORS without running the app or
accessing credentials. Normal doctor uses existing credentials for read-only
remote checks. Report unrecognized configuration as skipped and redact secrets
from diagnostic errors.

Use shared framework detection for package installation: TanStack Start receives
server and React packages; frontend-only React/Vite receives React, not server.
