# EdgeStore CLI

The official command-line interface for EdgeStore accounts and projects.

Inspect an application's integration context without login:

```sh
edgestore --cwd apps/web agent context --json
```

Context schema version 1 reports installed application package versions and their
bundled reference paths, not the CLI's transitive dependencies. Read local references
before online examples. An ambiguous workspace root returns candidate directories
and exit code 2; select one with `--cwd`. Existing 0.2 applications must explicitly
choose maintenance or migration. Environment-file contents and credentials are
never returned. Agent/MCP configuration reports visible per-client installation
status and unknowns, never raw configuration or authentication claims.

## Agent setup and updates

```sh
edgestore agent setup --client codex --dry-run --json
edgestore agent setup --client codex --yes
edgestore agent status --client codex --json
edgestore agent update --client codex --yes
```

Use `claude` or `cursor` for those clients. Default setup is project-local skills
plus the same hosted MCP configuration as `mcp setup`. `--skills-only` does not
read or alter MCP settings; `--global` explicitly selects user scope. Skill paths
are `.agents/skills` for Codex, `.claude/skills` for Claude Code, and `.cursor/skills`
for Cursor (under the Git/package root, or home for global setup). Existing global
skills and Cursor's shared `.agents` source are reported without installing a
duplicate. Other plugin/enterprise sources may be inaccessible; check the client.

The CLI ships a deterministic snapshot of the canonical setup skill. Setup and
updates do not fetch Git HEAD or call a third-party installer. `status` compares
installed hashes with the snapshot bundled in **this CLI**, not the latest online
release. `setup` is a no-op for an older owned snapshot and reports
`update-available`; use `update` to apply the currently bundled snapshot. Installing
a newer skill never upgrades the application's runtime packages or their API refs.

Ownership metadata is `.edgestore/skill-assets.json`, separate from MCP ownership
so skills-only workflows stay independent. Keep it with the installed files.
Updates replace only unchanged owned assets and remove only obsolete unchanged
owned files. User edits, extra files, and symlinks are preserved and block the
update even with `--yes`. Dry runs write nothing. All proposed skill/MCP files are
preflighted before writes; writes are individually atomic and partial failures
report applied paths. Open a new task/restart the client to load updated skills.

For source-based installation, the independent `skills` tool can discover the
canonical directory with `npx skills add ./skills --list` from this repository.
That tool owns its own installation/update behavior; EdgeStore does not overwrite
its user-owned or symlinked assets. The repository plugin is another skill source,
not a requirement for direct MCP setup.

## Direct MCP configuration

Configure the hosted connection independently of skills or plugins:

```sh
edgestore mcp setup --client codex --dry-run --json
edgestore mcp setup --client codex --yes
edgestore mcp status --client codex --json
edgestore mcp remove --client codex --yes
```

Clients: `codex`, `claude` (Claude Code), and `cursor`. Project scope defaults to
the Git root, or the package root outside Git. `--cwd` selects that context;
`--global` explicitly selects user configuration instead. Noninteractive writes
require `--yes`, which never overrides a collision or a modified entry.

| Client | Project configuration | User configuration |
| --- | --- | --- |
| Codex | `.codex/config.toml` | `$CODEX_HOME/config.toml` or `~/.codex/config.toml` |
| Claude Code | `.mcp.json` | `~/.claude.json` |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` |

Setup preserves unrelated configuration and JSONC comments. A matching existing
connection is left unmanaged; an inherited or differently named connection is
reported without adding a duplicate. Observable enabled Codex plugin entries are
also preserved, but a plugin's name alone does not prove it provides a connection.
CLI setup reports unknown plugin connection inventory; check the client for
duplicates. It does not inspect every plugin source or edit plugin inventory.

Ownership hashes live in `.edgestore/agent-assets.json` (or the CLI's user config
directory for global setup). Keep this metadata with the managed configuration
to allow safe removal. `remove` only removes an unchanged owned entry, leaving the
shared config file and unrelated settings intact. A later write failure reports
which files were already applied; file writes are individually atomic, not a
multi-file transaction. Dry runs write nothing and never print config contents.

The endpoint is `https://api.edgestore.dev/mcp`, not selected by `--api-url`.
Configuration status is not connectivity or authentication status. Setup never
logs in, requests scopes, grants tool permissions, or provisions resources. Open
the client when access is needed and review its consent flow. Start read-only;
if the client cannot narrow the request, do not approve broader access without
the user's authorization. Codex project configuration also requires project trust.

Adapter contracts: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[Claude Code MCP](https://code.claude.com/docs/en/mcp), and
[Cursor MCP](https://prod.cursor.com/help/customization/mcp).

## Local diagnostics

```sh
edgestore --cwd apps/web doctor --offline --json
edgestore --cwd apps/api doctor --json
```

`--offline` does not access the credential store, OAuth, or APIs. Without it,
doctor uses only an existing usable credential, never initiates login or refresh,
and skips all network checks if none is available. Remote checks are reads only.

Checks report `pass`, `warn`, `fail`, or `skip`; any failure returns exit code 1.
Warnings/skips do not mean the integration works. Application inspection is
bounded to 200 source files, 2 MB, 2,000 directory entries, and ten directory
levels in the selected package. It skips nested packages, dependency/build
directories, symlinks, tests, and unparseable syntax. Parsing does not execute
application code. Direct imports/JSX/CORS are observations, not a full module
graph, route-mount proof, or security audit. Custom routing, provider ancestry,
environment loading, and remote bucket mapping still require application checks.

Environment diagnostics report presence and unsafe destinations, never values.
Existing single env files are detected; ambiguous loaders remain explicit skips.
`init --install` now distinguishes Start from frontend-only React/Vite: the latter
gets only `@edgestore/react`, and still needs a separately selected backend.

```sh
npm install --global @edgestore/cli
edgestore --help
```

Log in through the dashboard, then use `init` for guided local setup:

```sh
edgestore login
edgestore init
```

Use `edgestore login --device` when a local browser callback is unavailable.
Use `edgestore login --token` or `EDGESTORE_TOKEN` for automation. Persisted
credentials are stored in the operating system credential store and are never
written to a plaintext config file.

The CLI manages accounts, projects and their keys, management tokens, buckets,
files, uploads, team members, and invitations. Interactive users can display a
new secret once. Automated project-key creation and rotation require `--output`
to a protected, gitignored backend env file. JSON returns metadata and delivery
information only, never `secretKey`; scripts that previously consumed that field
must use file delivery instead. Do not read generated secrets back into agent
context.

```sh
edgestore project list
edgestore bucket create publicFiles --type file --public
edgestore file upload ./logo.png --bucket publicFiles
edgestore project key create <basePath> --name local --output .env.local
```

`init` reuses its configured env destination, or detects existing env files before
choosing `.env.local`. For an ambiguous noninteractive destination, pass `--output`
explicitly after checking which file the backend loads.

In a monorepo, run commands from the application package or select it
explicitly with `--cwd`:

```sh
edgestore --cwd apps/web init
edgestore --cwd apps/web bucket list
```

Each workspace package keeps its own `.edgestore/config.json`. From a configured
monorepo root, the CLI uses the root configuration. From an unconfigured root,
it uses the only configured package automatically or asks which package to use
when more than one is configured. Automation should pass `--cwd` or an explicit
`--project` when the choice is ambiguous.

Use `--json` for structured output and `--plain` for commands with one natural
value. Both modes are non-interactive, so pass required choices explicitly and
use `--yes` when a command requires confirmation. Run `edgestore completion
bash`, `zsh`, or `fish` to configure shell completion.
