# Releases from main

`main` is the normal release branch. The v1 integration keeps the published
`1.0.0-next.5` package versions and changes `.changeset/pre.json` to `rc`.
It includes a pending changeset, so the release action opens a version PR.
Merging the integration does not itself version the packages.

## Release candidate

1. Merge the full v1 integration with a **merge commit**, preserving the existing
   `next` history. Stop using `next` as a separate publishing lane.
2. Review the Changesets version PR against `main`. Changesets continues the
   prerelease counter, so the first candidate is expected to be `1.0.0-rc.6`,
   not `1.0.0-rc.0`. Check all five packages, internal dependencies, lockfile,
   changelogs, and generated version constants.
3. Merge the version PR to publish under `rc`. Check the Release workflow and
   the npm tags for server, react, shared, sdk, and cli. Verify that the stable
   server/react/shared `latest` tags remain `0.8.0`.
4. Once publishing succeeds, change the public docs' installation instructions,
   registry dependencies (both `registry.json` and `docs/public/r`), setup prompts,
   and version notices from `@next` to `@rc`. Keep the v0 archive unchanged.

Until step 4 the site deliberately uses the already published `@next` tag.
The docs source and package source now share one branch; normal version syncing
updates the docs app's workspace dependencies in the version PR.

Do not manually bump package manifests on a normal feature PR: when there are no
pending changesets, the release action can publish any unpublished manifest
versions. The version PR is the intended publication approval point, not a
blanket guarantee that every other merge is unable to publish.

## Stable v1

Run **Promote stable** after the RC is accepted. It checks out `main`, exits
Changesets prerelease mode, generates stable versions, and opens a PR against
`main`. Review and merge that PR to publish v1 under `latest`. Then update the
docs' install commands and prerelease notices, and publish the release blog post
with the actual release date. Keep `/v0/docs` and `/v0/r` available for v0 users.

## Maintenance releases

Create the maintenance branch from the exact package release tag:

```sh
git switch -c 1.x '@edgestore/server@1.9.3'
git push -u origin 1.x
```

Backport the fix through a PR and add a Changeset. Then run the **Release**
workflow on `1.x`, select the `maintenance` operation, and provide the explicit
npm tag `legacy-v1`.

- With pending Changesets, the workflow creates or updates a version PR.
- After that PR is merged, run the workflow again with the same tag to publish.
- The workflow requires a matching `<major>.x` branch and explicit
  `legacy-v<major>` tag.
- It records npm's `latest` tags before publishing and fails if any of them
  move.

The local equivalent is:

```sh
pnpm version
pnpm release -- --tag legacy-v1
git push --follow-tags
```

## Canary snapshots

Run the **Release** workflow on a PR branch that contains at least one
Changeset and select the `canary` operation. It runs the equivalent of:

```sh
pnpm changeset version --snapshot canary
pnpm -s sync-versions
pnpm build
pnpm changeset publish --tag canary --no-git-tag
```

Canary versions use the `0.0.0-canary-YYYYMMDDHHMMSS` shape. The workflow has
read-only repository permission, creates no Git tags, reports exact package
versions, and discards all snapshot version changes when its ephemeral worker
ends.

## Verify npm dist-tags

After a release, inspect every public package:

```sh
pnpm view @edgestore/server dist-tags --json
pnpm view @edgestore/react dist-tags --json
pnpm view @edgestore/shared dist-tags --json
pnpm view @edgestore/sdk dist-tags --json
pnpm view @edgestore/cli dist-tags --json
```

Expected tags are `latest` for stable, `next` or `rc` for prereleases,
`legacy-v<major>` for maintenance, and `canary` for snapshots. During the RC
phase, `next` may intentionally point to the same version as `rc`.

## Recover from a wrong dist-tag

Do not unpublish a package. Move the affected tag to the intended existing
version:

```sh
npm dist-tag add @edgestore/server@2.0.1 latest
```

If a tag should not exist, remove only the tag:

```sh
npm dist-tag rm @edgestore/server canary
```

Repeat the repair for all five fixed `@edgestore/*` packages, then rerun the
dist-tag verification commands above.
