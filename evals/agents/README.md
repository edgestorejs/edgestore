# Manual agent evaluations

Compare EdgeStore setup with and without the skill in Next.js App Router,
Vite + Hono, and TanStack Start. The starters have pinned dependencies and no
EdgeStore integration. CI runs policy tests only.

## Check the packages

Use Node 24+ and pnpm 11.15.1 from a clean checkout:

```sh
pnpm build
pnpm eval:agents:test
pnpm eval:agents prepare next
pnpm eval:agents artifact <run-directory>
```

Use the directory printed by `prepare`. Repeat with `start` and `vite-hono`.

`prepare` packs the five local packages and creates these temporary directories:

- `baseline/` and `skill/` contain matching starters, prompts, and Git snapshots.
  Only `skill/` has the setup skill installed. Neither has MCP or credentials.
- `tools/` contains the packed CLI and SDK.
- `artifacts/` contains tarballs. Workspace overrides pin all EdgeStore
  dependencies to these files, including transitive dependencies.

`artifact` creates a third starter. It checks package versions, export files,
adapter imports, reference indexes, skill installation, and MCP configuration
for each client. It also builds and typechecks the starter. This does not test
agent behavior, authentication, or uploads.

For byte-for-byte checks of packaged references and skill files, run
`pnpm agent-docs:pack-check` and `pnpm agent-assets:pack-check`.

The run directory retains tarball hashes, the source commit, timings, sanitized
logs, and `run.json`. Commands time out after ten minutes. After a partial failure,
start a fresh run; the runner refuses to overwrite an existing application.
Copy results elsewhere if you need to keep them beyond OS temporary-file cleanup.

## Run the comparison

Launch the coding client manually with the same version, model, reasoning setting,
permissions, and time budget for both starters. Record these settings, elapsed
time, and any intervention.

For Codex, use `home-baseline/` and `home-skill/` as separate HOME directories.
Set CODEX_HOME to `.codex` inside each. Log in to Codex there without copying
personal settings, plugins, or skills. Run:

```sh
codex exec --ignore-user-config --ephemeral --sandbox workspace-write --cd <app>
```

Supply `prompt-baseline.md` or `prompt-skill.md`. Check `codex exec --help` for
your installed version. Keep the sandbox enabled. A separate HOME does not
restrict filesystem access.

Use the environment allowlist in `isolatedEnv`. Exclude EdgeStore credentials,
unrelated service credentials, and NODE_OPTIONS. Introduce backend credentials
only after the coding session ends. The runner sanitizes its own logs; it does
not capture or sanitize a separately launched client's transcript.

Review the generated diff, untracked files, and package scripts before running:

```sh
pnpm eval:agents check <run-directory> baseline
pnpm eval:agents check <run-directory> skill
```

`check` runs build, typecheck, offline doctor, and `git diff --check`. Start builds
first to generate route types. Review doctor warnings and skips. Confirm the app
has an upload UI, a backend router, and type-only server imports on the frontend.
Behavioral results remain `not-run` until you review the implementation and test
a live upload.

## Test a live upload

Provisioning, browser testing, and cleanup are manual. Use a dedicated
non-production account. Verify the API and file origins; `next.edgestore.dev`
is the docs preview.

1. Get approval to create and delete this run's resources. Create a uniquely named
   project with overage disabled and a public file bucket named `evaluationFiles`.
   Record the account, API origin, project ID, base path, and bucket ID as each
   operation succeeds. If a request's outcome is uncertain, look up the resource
   before retrying.
2. After the coding session ends, supply the project key and
   `EDGE_STORE_API_ENDPOINT` to the backend process only. Keep management
   credentials outside the app. Exclude secrets and signed URLs from transcripts.
3. Build and start the app. The UI uses port 4010; Hono uses 4011. In a browser,
   select a small, uniquely named file with Choose file, then click Upload.
   Check progress, errors, and the resulting filename link.
4. Retrieve the uploaded file independently and compare its bytes to the original.
   Check that it belongs to the recorded project and bucket and uses the expected
   file origin. An SDK or CLI upload does not test the app.
5. Verify the account, project ID, base path, and name before deleting the recorded
   test resources. Confirm deletion. If cleanup fails or the run stops, keep the
   resource record and report the remaining IDs so cleanup can resume.

Record which checks passed and which remain incomplete. Claude Code and Cursor
comparisons are optional when subscriptions are unavailable.
