---
"@edgestore/server": major
"@edgestore/shared": major
---

Redesign the router-derived backend client around explicit provider capabilities,
canonical API v2 file records, ID/key/URL references, flat cursor pagination,
async iteration, and singular or partial-result batch lifecycle methods. Router
context is now a flat map of string values (with optional properties) so hooks,
path and metadata builders, and provider access tokens share one contract.
