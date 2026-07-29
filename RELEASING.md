# Releasing

EdgeStore uses separate release lanes for stable, upcoming, maintenance, and
optional canary packages. Vercel continues to deploy production from `main`;
package publication does not change the documentation deployment model.

## Choose the target branch

| Change                                 | Target branch | npm tag    |
| -------------------------------------- | ------------- | ---------- |
| Stable fix or release infrastructure   | `main`        | `latest`   |
| Work for the upcoming breaking release | `next`        | `next`     |
| Backport for a supported major         | `<major>.x`   | `v<major>` |
| Temporary snapshot from a PR branch    | PR branch     | `canary`   |

Forward-merge stable fixes from `main` into `next`. Do not routinely merge
`next` into `main`. A forward merge does not need an immediate prerelease; a
later Changeset release can include it.

All published `@edgestore/*` behavior and public API changes require a
Changeset. Use `patch` for fixes, `minor` for backward-compatible features, and
`major` for breaking changes.

## Stable releases

Changes merged to `main` keep the existing Changesets release-PR flow:

1. Merge changes containing Changesets into `main`.
2. Review and merge the generated **Version Packages** PR.
3. The release workflow publishes stable versions to npm's `latest` tag.
4. The workflow verifies the published dist-tags.

The guarded local equivalent is:

```sh
pnpm release:check -- --branch main --tag latest
pnpm release
```

Normal stable releases should use the automated PR rather than running these
commands locally.

## The `next` prerelease lane

Create `next` from `main` after the release-lane infrastructure is available:

```sh
git switch main
git pull --ff-only
git switch -c next
git push -u origin next
```

Feature PRs for the upcoming breaking release target `next` and include normal
Changesets. The release workflow creates a **Version Packages (next)** PR.
When it creates the first version PR, the version command automatically enters
Changesets prerelease mode and includes `.changeset/pre.json` in that PR.
Merging it publishes versions such as `2.0.0-next.0` to npm's `next` tag.

The guarded local equivalent is:

```sh
pnpm release:check -- --branch next --tag next
pnpm release
```

Do not run `changeset pre exit` directly on `next`.

## Promote `next` to stable

Run the **Promote next** workflow from GitHub Actions. The workflow:

1. Checks out and validates the current `next` commit.
2. Verifies that `main` is contained in `next`.
3. Runs `changeset pre exit` and the repository version command.
4. Runs the release guards, formatting, lint, build, typecheck, and tests.
5. Opens a promotion PR into `main`.

Merge the promotion PR with a **merge commit**. If `next` advances after the
workflow starts, those later changes remain on `next` for a future promotion.

Merging the promotion PR publishes to `latest`. After publication, automation
synchronizes `next` to the released `main` and enters prerelease mode again. If
branch protection blocks the direct update, automation opens a **Start next
prerelease cycle** PR instead.

## Maintenance releases

Create the maintenance branch from the exact package release tag:

```sh
git switch -c 1.x '@edgestore/server@1.9.3'
git push -u origin 1.x
```

Backport the fix through a PR and add a Changeset. Then run the **Release**
workflow on `1.x`, select the `maintenance` operation, and provide the explicit
npm tag `v1`.

- With pending Changesets, the workflow creates or updates a version PR.
- After that PR is merged, run the workflow again with the same tag to publish.
- Guards require stable versions, matching branch/version majors, and the exact
  `v<major>` tag.
- The workflow records npm's `latest` tags before publishing and fails if any
  of them move.

The guarded local equivalent is:

```sh
pnpm release:check -- --branch 1.x --tag v1
pnpm release -- --tag v1
git push --follow-tags
```

## Canary snapshots

Run the **Release** workflow on a PR branch that contains at least one
Changeset and select the `canary` operation. It runs the equivalent of:

```sh
pnpm changeset version --snapshot canary
pnpm -s sync-versions
pnpm release -- --branch "$BRANCH" --lane canary --tag canary --no-git-tag
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
```

Expected tags are `latest` for stable, `next` for prereleases, `v<major>` for
maintenance, and `canary` for snapshots.

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

Repeat the repair for all three fixed `@edgestore/*` packages, then rerun the
dist-tag verification commands above.
