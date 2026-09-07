# EdgeStore docs

Run `pnpm docs:dev` from the repository root.

## Deployment

The docs default to `https://edgestore.dev` with GitHub source links on `main`.
Set `DOCS_RELEASE_CHANNEL=next` only on the deployment serving prerelease docs.
This selects `https://next.edgestore.dev` and the `next` source branch together.

For a local preview build:

```sh
DOCS_RELEASE_CHANNEL=next pnpm --filter docs build
```

Leave the variable unset, or set it to `stable`, on the production docs deployment.
A build from `main` rejects the `next` channel. Branch detection uses Vercel's
commit ref or GitHub Actions' head/ref name. Turbo includes these settings in its
cache key. Deployment settings do not change links in published package references;
those follow the package version.

Run `pnpm --filter docs test:agents` to check both channels and the production guard.
