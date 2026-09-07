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
never returned. Agent/MCP configuration currently reports `not-inspected`.

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
