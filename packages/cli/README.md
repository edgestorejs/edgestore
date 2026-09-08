# EdgeStore CLI

The official command-line interface for EdgeStore accounts and projects.

Inspect installed EdgeStore versions and local reference paths without logging in:

```sh
edgestore --cwd apps/web agent context --json
```

`agent context` reads the application's packages, not the CLI's dependencies.
If several workspaces match, it lists them and returns exit code 2. Select one
with `--cwd`. The JSON uses schema version 1 and excludes env values and secrets.
Agent and MCP configuration report `not-inspected`.

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
