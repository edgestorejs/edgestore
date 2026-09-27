# EdgeStore docs

Run `pnpm docs:dev` from the repository root.

## Hosted skill

`/SKILL.md` serves the canonical `skills/edgestore-setup/SKILL.md` from the repo
root. Its local reference links are rewritten to the same site's
`/skills/edgestore-setup/references/` routes. Both documents are rendered as static
Markdown at build time; there is no separately maintained web copy.

Edit the canonical skill and rebuild the docs to publish changes. Turbo already
includes `skills/**` in build inputs. If the skill gains references, add their
routes and extend the hosted-skill tests.

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
