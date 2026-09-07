---
'@edgestore/cli': minor
---

Add `doctor --offline` with no credential-store, OAuth, or API access. Normal
doctor runs now require an existing usable credential before remote checks and
do not refresh or mutate credentials. Add bounded, nonexecuting application
inspection for version compatibility, environment boundaries, type-only router
imports, direct adapter/provider usage, legacy handler options, and unsafe CORS.
Report unknown/dynamic wiring as skipped, not verified. Sanitize diagnostic errors.

Use shared framework detection for package installation: TanStack Start receives
server and React packages; frontend-only React/Vite receives React, not server.
