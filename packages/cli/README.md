# EdgeStore CLI

The official command-line interface for EdgeStore accounts and projects.

```sh
npm install --global @edgestore/cli
edgestore --help
```

Log in with a management token, then use `init` for guided local setup:

```sh
edgestore login --token
edgestore init
```

Use `EDGESTORE_TOKEN` for automation. Persisted credentials are stored in the
operating system credential store and are never written to a plaintext config
file.

The CLI manages accounts, projects and their keys, management tokens, buckets,
files, uploads, team members, and invitations. Secrets are returned only when
they are created:

```sh
edgestore project list
edgestore bucket create publicFiles --type file --public
edgestore file upload ./logo.png --bucket publicFiles
edgestore project key create <basePath> --name local --output .env.local
```

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
value. Run `edgestore completion bash`, `zsh`, or `fish` to configure shell
completion.
