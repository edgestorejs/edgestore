# EdgeStore agent experience: implementation plan

Status: implementation in progress; stages are published as draft PRs.
Date: 2026-09-07.
Baseline: detached `next` at `8e0bb28debb64f7ee3d02abc1bbabd504e5dd0f9` (`1.0.0-next.3`).
The agreed scope and implementation direction are preserved below.

## Outcome and boundaries

An agent should take a supported application from a request to a working EdgeStore integration, with an actual upload through the application and independent retrieval. Configuration success, API health, or a CLI-only upload cannot establish this outcome.

Initial golden paths: Next.js App Router, a Vite + Hono workspace, and TanStack Start using the hosted EdgeStore provider. Existing Next Pages Router and S3/Azure/custom provider integrations receive reference guidance and preservation, not new infrastructure automation or a separate initial evaluation matrix.

Ship one complete consumer skill, `edgestore-setup`. Defer dedicated diagnosis, migration, and operations skills; generators/codemods; documentation MCP; local MCP wrappers; general workflow state; and new telemetry. Keep existing hosted MCP and CLI capabilities. Draft PR publication and testing are authorized; package/plugin release and deployment remain separate actions. Live tests must use verified non-production targets.

## Architecture

| Component | Responsibility | API/version authority |
| --- | --- | --- |
| Normal documentation | Authored API explanations and examples | Release source |
| Runtime package `agent-docs/` | Curated offline API references | Installed package version |
| Root `skills/edgestore-setup/` | Workflow, tool choice, safety, verification | Detects target application versions |
| Existing CLI | Local context, installation/configuration, linking, protected credential delivery, diagnostics | CLI version only governs CLI behavior |
| Existing hosted MCP | Supported remote account/project/bucket/file actions | Service contract and granted scopes |
| Repository-root plugin | Alternative distribution of the same skill and hosted connection | Independent plugin version |

Prefer MCP for an available, supported action; otherwise use CLI. Never repeat a mutation through the other transport merely to complete the workflow. Credential delivery and local linking remain CLI responsibilities when MCP cannot perform them. `agent setup` installs agent assets; `init` provisions/links resources; the skill edits the application.

## Delivery order

Implement the following as small reviewable changes. Stages are dependency boundaries, not requirements to produce seven large commits or PRs. Branch from the agreed next baseline and publish draft PRs as authorized. Do not switch the sibling repository or publish releases automatically.

Progress:

- Stage 1: [draft PR #238](https://github.com/edgestorejs/edgestore/pull/238), targeting next. Passed package/docs production build, Hono and Start builds, three docs contract tests, scoped lint, and local HTTP checks for both 308 redirects, agents HTML/Markdown and llms index/full responses. Removed legacy assets remain recoverable from Git history.
- Stage 2: [draft PR #239](https://github.com/edgestorejs/edgestore/pull/239), stacked on #238. Passed seven renderer/build tests, script typecheck/lint, dependency-policy check, package builds/typechecks/runtime tests/type tests, and byte-for-byte checks of all 16 reference files across three real tarballs. The entrypoint generator now explicitly preserves additional package assets. Implementation lives in `scripts/agentDocs/` to follow repository naming rules.
- Stage 3a: application context implemented. Passed 18 new tests, all 256 CLI tests, CLI typecheck/lint/build, and a built-command smoke test against TanStack Start. Resolution is bounded to the application's repository/workspace and follows package-manager symlinks, never ambient global modules. Agent/MCP inspection remains explicitly not-inspected until stage 4. Draft PR publication in progress.
- Stage 3b (credential safety) and stages 4–7: pending.

### 1. Repair the documentation foundation

Files:

- Replace `docs/content/docs/(getting-started)/llms-vibe-coding.mdx` with `agents.mdx`; update `docs/content/docs/meta.json`.
- Add a permanent `/docs/llms-vibe-coding` → `/docs/agents` redirect in `docs/next.config.mjs`.
- Delete the four Markdown files under `docs/public/r/vibestack/` and remove remaining VibeStack references, except the necessary legacy redirect identifier.
- Update `docs/content/docs/adapters/tanstack-start.mdx` against `examples/start-basic/src/routes/api/edgestore.$.ts` and its pinned dependencies.
- Update Hono guidance and `examples/hono-basic/` for narrowly configured development CORS and an actually loaded server environment file.

Direction:

- Build the agents page incrementally; do not claim unreleased commands work. Finish installation examples after stages 3–5.
- Preserve generic llms endpoints, per-page Markdown, Copy Markdown, and the independent shadcn registry.
- Preview references point to `next.edgestore.dev`; production 0.2 documentation is not promoted as a side effect.
- Do not globally repoint the shared `examples/vite-basic` to Hono: it currently also supports Express/Fastify workflows. The dedicated evaluation workspace will use its real Hono router type.

Acceptance:

- No obsolete VibeStack content or registry dependency remains; the legacy page permanently redirects without a loop.
- Docs build and Markdown routes work; Start code matches the maintained route API.
- Hono example checks pass and does not reflect arbitrary origins with credentials.

### 2. Ship exact-version package references

Proposed files: `scripts/agent-docs/` for a small selection map, renderer, and tests; generated `packages/{server,react,sdk}/agent-docs/`; those packages' manifests; `turbo.json`.

Direction:

- Select existing documentation pages/sections and deterministically render useful Markdown. Use an MDX parser/transformer where needed, not broad regular-expression stripping. Avoid a full website build as a package-build prerequisite.
- Generate a compact index recording package name/version and source page links. Keep server adapters/providers, React client APIs, and SDK APIs in their owning packages, without full-site duplication.
- Preserve code blocks and meaningful admonitions. Convert documentation-only install widgets and links into readable text; fail on unsupported constructs that would silently lose important guidance.
- Treat generated references as build artifacts, not a second authored manual. Include them in package `files`; declare docs inputs and generated outputs in Turbo so documentation changes invalidate cached artifacts.
- Resolve package roots through existing package metadata exports; do not add a new runtime API merely to expose Markdown.
- Add packed-tarball checks and a contributor note requiring API changes to update the relevant docs.

Acceptance:

- Two runs with identical inputs produce identical references; changed docs invalidate the correct build output.
- Packed server/react/sdk artifacts contain their version-stamped indexes and expected references, with valid local links and no website-runtime dependency.
- Tests cover code fences, custom MDX components, missing source sections, and stale generated output. Existing package builds/exports continue to work.

### 3. Establish application context and safe credential behavior

Files: extend `packages/cli/src/core/workspace.ts`; add focused context/reference-resolution modules and `commands/agent.ts`; register commands in `packages/cli/src/cli.ts`. Reuse `core/config.ts`, `core/packageInstall.ts`, `core/secretDelivery.ts`, `core/secretFile.ts`, and existing init/recovery behavior.

Direction:

- Implement `edgestore agent context --json`, with `schemaVersion`, selected workspace, framework/app role, package manager, installed package versions, local reference paths/version, project linkage, and agent/MCP configuration status. Return facts and unknowns, not a speculative complete application model.
- Respect `--cwd` and existing workspace selection. If a monorepo root is ambiguous, report candidate workspaces or require selection; never resolve the CLI's own SDK as the app's SDK.
- Route installed v1 packages to bundled references. If absent, clearly distinguish a version-specific fallback from moving preview guidance. Before installation use preview docs for prereleases. Existing 0.2 integrations must explicitly choose maintenance or migration; never silently upgrade or mix APIs. Unsupported future versions must be reported rather than assumed compatible.
- Detect an existing backend env convention before applying framework defaults. Keep secrets out of context, JSON/plain output, errors, and reports. Inspect secret contents only inside local implementation code when necessary; never return them to the model.
- Audit project-key create/rotate and init output together. Require safe delivery before remote key creation in agent-facing paths; retain revocation/recovery on delivery failure. Preserve safe existing human workflows where compatible with the agreed no-secret structured-output policy.
- Include explicit compatibility notes and an appropriate changeset for any removal of existing structured secret fields; do not disguise a breaking change as additive behavior.

Acceptance:

- Fixtures cover standalone apps, nested working directories, multiple workspaces, split frontend/backend, absent packages, pnpm layouts, 0.2, prereleases, mixed versions, and newer CLI/older app combinations.
- No discovery operation loads arbitrary application modules or initiates login.
- Secret sentinel tests cover success/failure JSON, plain output, stdout/stderr, rollback errors, and existing-file collisions. Credentials reach only an approved protected, gitignored backend destination.
- An MCP-created project can be linked and receive credentials through CLI without creating a second project or bucket.

### 4. Add agent and independent MCP configuration commands

Proposed files: `packages/cli/src/commands/{agent,mcp}.ts`, a small `core/agent/` directory for installation/provenance and three explicit client adapters, CLI asset packaging, command/completion tests, and CLI README updates.

Direction:

- Implement `agent setup|update|status` and `mcp setup|status|remove` using existing command/runtime/output conventions.
- Default agent setup to project-local skills plus MCP; support explicit global/client selection, skills-only, dry-run, yes, and JSON/noninteractive operation. Configuration setup must not initiate application provisioning or mandatory login.
- Package a generated copy of canonical root skills in the CLI artifact. This makes a released installer reproducible and usable without fetching mutable repository HEAD. Updating skills means choosing a newer released CLI asset revision; status reports the installed revision and local modifications, not a false promise of knowing the latest online release.
- Keep provenance minimal: asset revision and file hashes sufficient for safe updates. This is installation metadata, not application workflow state.
- Verify actual client config locations/formats against current official contracts before coding adapters. Use appropriate parsers/preserving edits for JSON/JSONC/TOML; no handwritten general-purpose config framework.
- Preflight all proposed changes, merge only owned entries, and use atomic per-file writes. Refuse modified/colliding entries even with `--yes`; report partial application if a later file fails. Removal deletes only positively identified, unchanged owned entries.
- Detect visible plugin-provided skills/connections before adding duplicates. CLI never edits plugin inventory. When plugin state is inaccessible, report uncertainty rather than asserting deduplication succeeded.
- Direct MCP configuration remains usable without a plugin or skills. Use the existing hosted endpoint; defer OAuth until needed. Do not invent a registration ID or silently select destructive scopes.

Acceptance:

- Table-driven tests for all three clients: empty/existing config, unrelated content, comments, malformed files, collisions, modified skills, repeat setup/update/remove, dry-run, global vs local, symlinks/path escapes, and simulated write failures.
- Dry-run has zero filesystem or remote writes; a second setup is a no-op; remove preserves user edits and unrelated connections.
- Packed CLI can install the exact canonical skill assets. Missing client subscriptions do not block these deterministic tests.
- Direct MCP setup and agent setup produce the same connection configuration; plugin/local coexistence is tested where observable.

### 5. Complete read-only diagnostics and the setup skill/plugin

Files: `packages/cli/src/commands/doctor.ts` and focused check modules/tests; `skills/edgestore-setup/SKILL.md` and minimal workflow references; `.codex-plugin/plugin.json`; hosted-connection metadata only after validating its contract; agents page and CLI docs.

Doctor direction:

- Share factual application inspection with context rather than duplicating framework detection.
- Add local checks for version compatibility, expected adapter/routes, env placement/loading, React provider integration, type-only frontend contracts, observable v0.2 patterns, and known unsafe CORS patterns.
- Use bounded nonexecuting inspection. Dynamic configuration is unknown/skipped, not a false failure or a guarantee of safety.
- Add `--offline`; remote checks only with usable existing credentials and no surprise login. Explicitly distinguish skipped checks from warnings/failures and give actionable suggestions. Do not add automatic fixes.
- Compare remote bucket identities only when the local mapping and authorization are observable; use existing service APIs.

Skill direction:

- Read the applicable skill-authoring instructions before authoring. Keep the main workflow concise and route to installed API references rather than copying framework APIs into the skill.
- Inspect → disclose implementation choices → prepare locally → provision/link when authorized → implement → run doctor/typecheck/build → upload through the application → independently retrieve → summarize remaining work and cleanup.
- Infer a contextual bucket name, falling back to `publicFiles`. Infer and disclose access policy; ask when ambiguous or sensitive. Do not impose an evidence field or a rigid response format.
- Reuse existing backend/resources/env files and architecture. Do not silently add Hono to a frontend-only app. Preserve third-party providers; use a type-only backend router contract in split workspaces.
- Prefer MCP when capable, CLI otherwise. Keep server keys and signed URLs out of model-visible output. Destructive operations require explicit authorization; test cleanup may be scoped and preauthorized.
- Report local-only completion honestly when auth/browser/runtime access prevents full verification.

Plugin direction:

- Read current plugin-authoring instructions and validate the manifest against the current contract. Root plugin references the same root skill, with independent semver and no custom UI.
- Resolve registered hosted connection prerequisites for the intended `.app.json`. If external registration is unavailable, do not ship a fake reference: complete the working skill/plugin subset and direct MCP path, and record hosted plugin wiring as an explicit incomplete release item.
- Do not install a personal marketplace, alter the user's plugin inventory, or submit publicly merely to author the repository plugin.

Acceptance:

- Doctor offline tests prove no network/login calls; remote tests are mocked; existing checks and exit-code semantics remain deliberate and documented.
- Skill has no unavailable-command instructions, obsolete APIs, silent upgrades, or mandatory report template.
- Local plugin validation succeeds; connection readiness and unavailable external registration are reported separately.
- Portable skill discovery is checked; real Codex smoke test where available, other clients best-effort.

### 6. Add the manual evaluation harness

Proposed files: `evals/agents/README.md`, pinned clean `fixtures/{next,vite-hono,start}/`, stable prompts and assertions, a small runner; root `eval:agents` script; ignored local run outputs.

Direction:

- Use dependency-free-from-EdgeStore starter fixtures, not already integrated examples. Vite/Hono is one workspace with a real exported backend router type, bounded CORS, and configurable API URL. Pin framework dependencies and lockfiles.
- Pack all required current EdgeStore packages, including transitive shared dependencies and CLI; install tarballs in disposable workspaces outside the source workspace so tests cannot pass through source symlinks or registry fallback to a different EdgeStore build.
- Start with Codex execution using available access. Keep runner integration small; no speculative agent-provider framework. Record executable/version/settings needed to reproduce a run.
- Define separate artifact/configuration checks, agent runs, and explicit live runs. Ordinary package CI may run deterministic tests/pack checks; no automatic agent or cloud runs.
- Stable task prompts ask for an application-facing upload UI. Drive upload through the resulting app/browser and independently retrieve/check the file; do not substitute SDK or CLI upload.
- For live runs require explicit non-production control-plane/account selection, compatible data-plane settings, and scoped cleanup authorization. `next.edgestore.dev` is a docs preview, not evidence of a staging API endpoint.
- Isolate each run with a unique project and matching router/remote bucket names unless the actual API proves another mapping valid.
- Track created resource IDs in a local redacted run ledger for cleanup after interruption; no general workflow database. Refuse cleanup outside that run's recorded target and resources.
- Capture sanitized transcripts, timing, checks and leftovers. Prevent credentials from entering transcripts at source; redaction is additional protection, not the only control. Avoid logging signed URLs.

Acceptance:

- A local artifact run proves packed exports/assets, fixture isolation, runner preflights, redaction, and failure/cleanup reporting without cloud access.
- Live gates: expected packages/config, no unrelated changes/tracked secrets, doctor, typecheck/build, app start, app-path upload, independent content retrieval, correct resource identity and completed scoped cleanup.
- A skipped prerequisite remains skipped/incomplete, never passes. Missing Claude/Cursor subscriptions are not release blockers.
- Cleanup can recover exact created resources from an interrupted run; failed cleanup reports nonsecret IDs and safe next actions.

### 7. Evaluate, fix demonstrated gaps, and prepare release handoff

- Retain one no-skill baseline per framework before v1; use the same pinned packages, prompt and permissions as the skill-enabled comparison. Isolate installed EdgeStore skills/plugin assets so the baseline is genuinely unassisted by those assets.
- Iterate on the skill-enabled three-framework golden paths. Classify failures as references, workflow, CLI, runtime, or hosted service before changing architecture.
- Only touch sibling `edge-store-app/apps/api/src/mcp/` when a reproducible gap requires it. Recheck sibling status and instructions first; retain service ownership and V2 API reuse. Run relevant MCP tests and API typecheck for any such change.
- Reconcile docs and installation examples with actual shipped commands. Add changesets for published behavior/API changes and document structured-output compatibility changes explicitly.
- Run package tests/typechecks/type tests, relevant example checks, docs build/redirect checks, packed-asset tests, and scoped lint/format checks. Record failures and prerequisites; earlier baseline test counts are not evidence for the new work.
- Produce a release checklist for v1 docs promotion, archived 0.2 routes, plugin connection/registration readiness, public submission, and package publication. These remain separate explicit release actions.

## First implementation slice

Start with stage 1 and stage 2's renderer/packed-reference proof. This removes stale guidance immediately and proves the versioning design before building installation adapters. Then deliver context plus credential-output safety, configuration commands, and finally the complete skill against those working contracts. The evaluation harness can be drafted earlier, but do not call a workflow verified until its full acceptance checks run.

## Technical findings versus user decisions

No further product interview is needed. Resolve implementation facts through code, official client documentation, and tests. Ask only when a finding requires changing an agreed policy or new authority—such as connector registration, unavailable non-production credentials, destructive cleanup not covered by the run, or a materially broader sibling change. Continue unaffected local work when external prerequisites are missing.

## Why this direction

1. Installed packages own API knowledge, while released CLI assets own workflow distribution. This permits independent CLI upgrades without silently changing the application's API guidance.
2. Build on the existing CLI and hosted MCP. The inspected repository already has workspace selection, OAuth, secret delivery/recovery and diagnostics; new infrastructure would duplicate working responsibilities.
3. Put commands and diagnostics before finalizing the skill. This avoids shipping prose that relies on capabilities not yet implemented.
4. Keep installation provenance separate from application state. Hashes support safe updates without creating a persistent agent workflow system.
5. Verify real application behavior using packed artifacts. This catches missing npm assets, bad adapter wiring, frontend/server boundary problems, and upload failures that unit tests or CLI uploads miss.
6. Separate deterministic checks from manual live evaluations. Local engineering can proceed without subscriptions or staging credentials, while full success still requires an honestly recorded live result.
7. Keep sibling changes evidence-driven and release actions explicit. The hosted MCP already exists; missing registration or infrastructure access should not trigger a speculative replacement service.
