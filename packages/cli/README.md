# EdgeStore CLI

The official command-line interface for EdgeStore accounts and projects.

Inspect installed EdgeStore versions and local reference paths without logging in:

```sh
edgestore --cwd apps/web agent context --json
```

`agent context` reads the application's packages, not the CLI's dependencies.
If several workspaces match, it lists them and returns exit code 2. Select one
with `--cwd`. The JSON uses schema version 1 and includes per-client skill and
MCP configuration status. It excludes env values, secrets, and raw config.

## Agent setup and updates

```sh
edgestore agent setup --client codex --dry-run --json
edgestore agent setup --client codex --yes
edgestore agent status --client codex --json
edgestore agent update --client codex --yes
```

Use `claude` for Claude Code or `cursor` for Cursor. Setup installs the skill and
configures MCP for the project. `--skills-only` leaves MCP settings untouched;
`--global` installs for all projects.

| Client | Skill directory |
| --- | --- |
| Codex | `.agents/skills` |
| Claude Code | `.claude/skills` |
| Cursor | `.cursor/skills` |

These paths are relative to the Git or package root, or your home for global
setup. The CLI reports existing global skills without installing a duplicate.

The skill comes from the installed CLI release. `status` compares against that
copy, not an online release. `setup` leaves older installed copies in place;
use `update` to replace them. Neither command upgrades application packages.

Keep `.edgestore/skill-assets.json` with the installed skill. Updates stop on
user edits, extra files, or symlinks, even with `--yes`. If a write fails, the error
lists files already changed. Restart the client or open a new task after updating.

For installation from source, run `npx skills add ./skills --list` in this repo.
The repository plugin includes the same skill. The CLI leaves skills installed
through other tools untouched.

## Direct MCP configuration

Configure the hosted connection independently of skills or plugins:

```sh
edgestore mcp setup --client codex --dry-run --json
edgestore mcp setup --client codex --yes
edgestore mcp status --client codex --json
edgestore mcp remove --client codex --yes
```

Use `codex`, `claude` for Claude Code, or `cursor`. Setup writes to the Git root,
or the package root outside Git. Use `--cwd` to select the project and `--global`
for user configuration. Automated writes require `--yes`.

| Client | Project configuration | User configuration |
| --- | --- | --- |
| Codex | `.codex/config.toml` | `$CODEX_HOME/config.toml` or `~/.codex/config.toml` |
| Claude Code | `.mcp.json` | `~/.claude.json` |
| Cursor | `.cursor/mcp.json` | `~/.cursor/mcp.json` |

Setup preserves existing connections, unrelated settings, and JSONC comments.
The CLI cannot inspect every plugin. Check your client for duplicate connections.

Keep `.edgestore/agent-assets.json` with the config. Global setup stores this
metadata in the CLI's user config directory. Removal requires an unchanged entry
created by this CLI. `--yes` does not override user edits or name conflicts.
If a write fails, the error lists files already changed.

Setup uses `https://api.edgestore.dev/mcp`; `--api-url` does not change it.
`status` checks configuration only. Sign in and grant permissions through your
client. Codex also requires project trust for project-local configuration.

Adapter contracts: [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli),
[Claude Code MCP](https://code.claude.com/docs/en/mcp), and
[Cursor MCP](https://prod.cursor.com/help/customization/mcp).

## Local diagnostics

```sh
edgestore --cwd apps/web doctor --offline --json
edgestore --cwd apps/api doctor --json
```

`--offline` skips credentials and network access. Normal doctor uses an existing
credential for read-only API checks. It does not log in or refresh credentials.

Checks return `pass`, `warn`, `fail`, or `skip`. A failure sets exit code 1.
Doctor checks adapter and provider imports, CORS, and env file locations without
running application code or returning env values. It cannot verify route mounting,
provider ancestry, custom env loading, or remote bucket mappings.

Source inspection stops at 200 files, 2 MB, 2,000 directory entries, or ten levels.
Nested packages, build outputs, dependencies, symlinks, tests, and unparseable
files are skipped. Test uploads through the application to check what static
inspection cannot.

## Install and log in

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

## Project keys

Interactive commands display a new key once. Automated key creation and rotation
require `--output` to a gitignored backend env file. JSON returns key metadata and
delivery status. Scripts that read `secretKey` from JSON must switch to file
delivery.

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
