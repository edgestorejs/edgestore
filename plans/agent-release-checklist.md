# Agent experience release checklist

These are release actions and external prerequisites, not actions performed by
the implementation PRs.

- Merge the ordered draft PR stack into `next` after review and CI. No PR is
  automatically merged, and no package or docs deployment is implicit.
- Publish compatible prerelease runtime and CLI artifacts with their changesets.
  Check real npm tarballs include exact-version `agent-docs` and released CLI skill
  assets. Document the CLI structured-secret-output breaking change.
- Keep API authority in installed packages even when the CLI/skill is newer.
- Run the manual, isolated baseline and skill-enabled evaluation for Next App
  Router, Vite/Hono, and TanStack Start. Configuration checks are not app-upload
  success. Record unavailable client access and runtime prerequisites honestly.
- Validate hosted OAuth scope consent with the actual clients. The current service
  advertises all supported scopes. Sibling `permissionScopeContext` and its tests
  select read-only scopes for new grants and preserve previous grants; the actual
  client consent still needs live verification. Configuration alone does not
  establish authorization. Do not silently approve broader permissions.
- Resolve the registered hosted connector needed by the intended plugin `.app.json`.
  The repository plugin currently includes the real setup skill only, with no fake
  connector ID or placeholder app manifest. Direct CLI MCP configuration remains
  independent and usable. Do not claim bundled hosted connectivity until verified.
- After connector registration is available, add and validate the real companion
  app manifest, verify deferred authentication, and test skill/direct/plugin
  coexistence without changing unrelated plugin inventory.
- Plugin version is independent (`0.1.0` initially). Public marketplace submission,
  installation-policy choices, screenshots, and publication require explicit action.
- Before v1 stable docs promotion, archive 0.2 guidance and update legacy fallback
  links; promote preview origins/ref deliberately. Keep permanent old-page redirects
  for `/docs/llms-vibe-coding` and its Markdown form.
- Live evaluation needs verified non-production control-plane and data-plane
  targets, an appropriate test account, and exact scoped cleanup. The docs preview
  at `next.edgestore.dev` establishes none of those prerequisites.

## Evaluation handoff

The local harness is documented in `evals/agents/README.md`. It prepares matched
baseline/skill workspaces and verifies installed tarballs in a separate starter.
It does not launch coding agents, provision cloud resources, drive a browser, or
automate ledger cleanup yet. Those are explicitly incomplete implementation and
verification items, not covered by an artifact pass. Dev API and file origins
have been verified; dedicated account/management access still needs selection.

## Local skill/plugin checks

The root `skills/edgestore-setup` is canonical; the plugin points at that directory.
Portable discovery from this checkout is `npx skills add ./skills --list`.
When these changes are merged to `next`, repository discovery can use
`npx skills add https://github.com/edgestorejs/edgestore/tree/next/skills/edgestore-setup --list`.
The repository route follows the selected Git revision; it is distinct from the
reproducible skill copy distributed in a released CLI artifact.
