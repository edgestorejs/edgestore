# Hosted setup and credential handoff

Use MCP first for supported account/project/bucket discovery and authorized
changes; otherwise use the CLI. Confirm the account and project in the tool's
metadata before making changes.

To configure MCP:

```sh
edgestore mcp setup --client codex --dry-run --json
edgestore mcp setup --client codex --yes
```

Use `claude` or `cursor` for those clients. Setup configures
`https://api.edgestore.dev/mcp`. Sign in through your client and review the
requested permissions.

Check `--help` for the installed CLI's available commands. Use `--json` and file
delivery to keep secrets out of tool output. Let the user complete any required login.

After MCP creates/selects a project, link the backend to that same project and
existing env convention:

```sh
edgestore --cwd <backend> project link <project-base-path> --env-file <env-file> --json
```

Reuse an existing valid backend key when possible. When a new key is authorized:

```sh
edgestore --cwd <backend> project key create <project-base-path> --name local --output <env-file> --json
```

The destination must be gitignored. If values already exist, inspect the
configuration before considering `--update`. Check key presence and project
association without reading secret values into agent context. If file delivery is
unavailable, ask the user to configure the key locally, not paste it into chat.
On partial failure, follow the returned recovery status before retrying.

`init` provisions or links resources. Use `project link` when MCP has already
created the project.
