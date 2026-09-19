# Hosted setup and credential handoff

Use this reference only for EdgeStore's hosted provider. Custom/S3/Azure providers
keep their existing credential and infrastructure workflows.

Use MCP first for supported account/project/bucket discovery and authorized
changes. Confirm the actual account and project in the tool's metadata; a local
project link is not proof that an MCP connection selects the same resources.
Tool schemas and consent determine capabilities, not the existence of a plugin.

When no connection is configured, the independent CLI path is:

```sh
edgestore mcp setup --client codex --dry-run --json
edgestore mcp setup --client codex --yes
```

Use `claude` or `cursor` for those clients. Setup configures
`https://api.edgestore.dev/mcp`. Sign in through your client and review the
requested permissions.

Check the installed CLI's `--help` before using it: a separately installed older
CLI may not include agent-safe commands. Use JSON metadata and protected file
delivery, not commands that display a secret once in the terminal. If the CLI
needs a login, let the user complete it without returning tokens to the model.

After MCP creates/selects a project, link the backend to that same project and
existing env convention:

```sh
edgestore --cwd <backend> project link <project-base-path> --env-file <env-file> --json
```

Reuse an existing valid backend key when possible. When a new key is authorized:

```sh
edgestore --cwd <backend> project key create <project-base-path> --name local --output <env-file> --json
```

Delivery validates a gitignored backend destination before creating a key. A
collision is a reason to inspect the existing configuration, not to add `--update`
automatically. Confirm only key presence, destination protection, and project
association. Do not read the generated values back into agent context. On partial
failure, follow the returned recovery status and inspect metadata before retrying.

If MCP cannot perform the needed remote operation, use the corresponding CLI
command after checking its help and resource selection. `init` provisions/links
resources. Never rerun provisioning merely because agent configuration completed.

Test uploads in the user's authorized EdgeStore project using the normal service.
Keep track of test files so cleanup targets only those files. Do not infer
permission to delete existing files, projects, or buckets.
