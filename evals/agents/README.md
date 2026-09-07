# Manual agent evaluations

The three pinned starters contain no EdgeStore integration: Next.js App Router,
Vite + Hono, and TanStack Start. Runs are local and opt-in. Ordinary CI only runs
the policy/fixture tests; it never starts an agent or creates hosted resources.

## Artifact checks

From the repository, with Node 24+ and pnpm 11.15.1:

```sh
pnpm build
pnpm eval:agents:test
pnpm eval:agents prepare next
# Use the absolute run directory printed by prepare:
pnpm eval:agents artifact <run-directory>
```

Repeat with `start` and `vite-hono`. `prepare` packs the five local packages,
records tarball SHA-256 hashes/versions and the source HEAD, and creates paired
`baseline/` and `skill/` applications under a new OS temporary directory. A
separate `tools/` installation contains the packed CLI/SDK. Initial starter
installation must accept the checked-in frozen lockfile; local overrides then
force every EdgeStore dependency, including transitive ones, to the tarballs.
The resulting locks and artifacts are retained with the run. The source HEAD
is provenance, not a claim of a clean checkout; use a clean commit for comparisons.

Both applications receive the same prompt, framework pins and package artifacts.
Only `skill/` receives the packed `edgestore-setup` skill. Neither receives MCP
configuration, project linking, hosted credentials or integrated source code.
Each starts with a local Git snapshot. Tools/configuration tests use disposable
homes, not the operator's installed client configuration.

`artifact` creates a **third** starter, leaving the comparison pair untouched.
It installs the runtime tarballs, checks resolved package paths and versions,
export targets and selected adapter imports, package reference indexes, skill
setup/idempotency, and MCP setup/status/removal for all three client formats.
It then builds/typechecks the starter. These are artifact/configuration tests,
not proof of an agent's implementation, MCP connectivity or an upload.
Byte-exact reference/skill contents are additionally covered by
`pnpm agent-docs:pack-check` and `pnpm agent-assets:pack-check`.

Each command has a ten-minute timeout and bounded captured output. Sanitized
command logs, timings and `run.json` remain in the disposable directory on
success or failure. The runner never recursively deletes an existing directory.
After a partial prepare/artifact failure, use a fresh `prepare` run; existing
application directories are not overwritten. Runs are temporary and are not a
durable results archive—save the nonsecret summary if it must outlive OS cleanup.

## Baseline versus skill runs

Run the client manually; the runner does not spawn or manage coding agents.
For Codex, use the same executable/version, model, reasoning setting, sandbox,
network permissions and time budget for both members of a pair. Record those
settings, elapsed time, result classification and any operator intervention.
Do not use a normal personal client session for the baseline: globally installed
skills/plugins would invalidate the comparison.

Use the run's `home-baseline/` and `home-skill/` as isolated `HOME` directories,
with separate `CODEX_HOME` directories under each. Authenticate the **coding
client only** there using its normal login flow; do not copy personal config,
skills, plugins, or EdgeStore credentials. Current Codex CLI supports
`exec --ignore-user-config --ephemeral --sandbox workspace-write --cd <app>`;
check `codex exec --help` for the installed version. Supply the corresponding
`prompt-baseline.md` or `prompt-skill.md` as the task. Neither prompt fixes a
model or prescribes a final-answer format. Never use sandbox-bypass flags for
an evaluation. Treat missing access or permissions as an incomplete run.

Use an allowlisted environment like the runner's `isolatedEnv` (PATH, temporary
directory, isolated HOME/client paths, telemetry opt-outs). In particular,
exclude `EDGESTORE_TOKEN`, backend keys, ambient `NODE_OPTIONS`, and unrelated
service credentials. Do not introduce application credentials until the coding
session has ended, even if the agent requests them. This prevents secret reads
from the evaluation's provisioning flow at the source; regex redaction alone
cannot make an unrestricted transcript safe. An isolated environment/home is
not an operating-system filesystem sandbox: keep the client's sandbox enabled
and do not grant access to unrelated repositories or secret stores.
Save only sanitized transcripts, without signed URLs or raw tool output from
secret-bearing processes. The harness captures its own local command logs; it
does not intercept an independently launched client's transcript.

After each coding run, inspect its diff, untracked files and package scripts
before executing the generated application. Then:

```sh
pnpm eval:agents check <run-directory> baseline
pnpm eval:agents check <run-directory> skill
```

These checks run build, typecheck, offline doctor in each relevant package, and
`git diff --check`. Start builds first so generated route types exist. An exit
zero from doctor may still contain skipped runtime checks: review them. Inspect
the Git diff, new files, package locks and transcript for unrelated changes,
server/client boundary mistakes, fake verification and secrets. Confirm the
backend router and app-facing upload actually exist. The harness deliberately
leaves behavioral results `not-run` until this manual review and live testing;
a passing blank starter must never become an agent-quality pass.

## Live application-path verification: separate, still manual

Live provisioning/browser/cleanup automation is not included yet. Before running
this protocol, select a dedicated non-production account and verify both API and
file origins. `next.edgestore.dev` is a documentation preview, not a data-plane
configuration. Do not infer an account from an arbitrary service signing key.

1. Record the selected account, control-plane origin, file origin and unique run
   project name. Confirm permission to create and clean up that run's resources.
   Keep the management credential outside the application and transcript.
2. Create a dedicated project with overage disabled, and record its returned ID
   and base path immediately in a private local **nonsecret ledger**. Create the
   public file bucket `evaluationFiles` matching the task's router. Record bucket
   IDs and creation results, not secrets. If creation is uncertain, investigate
   the unique name rather than retrying and potentially making duplicates.
3. After the coding agent has exited, deliver the project's key to the backend
   process only, alongside the selected `EDGE_STORE_API_ENDPOINT`. Do not place
   secrets in frontend env vars, command arguments, Git, task messages, or agent
   transcripts. Keep both baseline and skill runs on the same environment policy.
4. Build/typecheck, start the resulting application (UI port 4010; Hono API port
   4011), and use a browser to select a small uniquely named file through
   **Choose file**, then **Upload**. Verify progress/error behavior and the
   resulting filename link. Do not replace this with an SDK/CLI upload.
5. Independently retrieve the uploaded public file and compare bytes with the
   original. Confirm the returned file belongs to the recorded project/bucket
   and expected file origin. Record nonsecret IDs and verdicts; omit signed URLs.
6. Using the exact ledger targets, remove only the created files/bucket/project.
   Re-read and verify account, ID, base path and unique name before destructive
   cleanup. Do not empty an existing unrelated bucket. Confirm deletion; if it
   fails or the run is interrupted, retain the ledger and report exact leftover
   IDs and the safe cleanup action. Never label unconfirmed cleanup successful.

Full success requires the app-path upload, independent byte check, correct
resource identity and confirmed cleanup. Otherwise report precisely which gate
is incomplete. Classify failures as package/reference, skill workflow, CLI,
application integration, hosted service or unavailable prerequisites before
changing architecture. Claude Code/Cursor behavioral comparisons remain
best-effort when subscriptions are unavailable.
