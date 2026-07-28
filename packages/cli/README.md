# EdgeStore CLI

The official command-line interface for EdgeStore accounts and projects.

```sh
pnpm add --global @edgestore/cli
edgestore --help
```

The initial release supports management-token login, account selection, project
listing, and local project linking:

```sh
edgestore login --token
edgestore account list
edgestore account switch personal
edgestore project list
edgestore project link <basePath>
```

Use `EDGESTORE_TOKEN` for automation. Persisted credentials are stored in the
operating system credential store and are never written to a plaintext config
file.
