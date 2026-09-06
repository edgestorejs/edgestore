# Project file URLs

The hosted EdgeStore provider can discover project file origins from the service. Upload, delete, get, list, and signed-URL calls keep the same API; continue storing and using the returned URL instead of constructing a hostname yourself.

For a migrated existing project, new results use its project hostname while previously saved shared-host URLs remain supported. With protected buckets, the React provider initializes both hosts so saved links remain readable after migration. Initialization fails if any required host cannot be initialized; reset/retry behaves as before.

Upgrade `@edgestore/server` and `@edgestore/react` together before opting a protected project into project URLs. The updated server reports `clientInit.urls` and the updated React provider initializes those URLs. Older service responses and other providers retain the `baseUrl` plus `path` fallback.

Review application image-host allowlists (such as Next.js remotePatterns), CSP, and any hardcoded file origins before migration. An explicit `EDGE_STORE_BASE_URL` continues to take precedence over discovered initialization origins; review that override before enabling project domains.

New projects created after the service rollout use project hosts only. Existing projects preserve legacy access. Custom domains are deferred, and no new customer configuration option is introduced in this release. Real cross-site browser cookie restrictions still apply; signed read URLs remain available where cookie-based access is unsuitable.
