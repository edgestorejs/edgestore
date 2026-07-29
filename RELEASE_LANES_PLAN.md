# Release Lanes Plan

This document records the agreed direction for EdgeStore package releases. It
is an implementation plan, not the final release runbook. The finished
workflow should be documented in `RELEASING.md`.

## Goals

- Support stable, prerelease, maintenance, and optional canary releases.
- Keep the existing Vercel behavior: `main` continues to deploy automatically.
- Do not add versioned or separate prerelease documentation yet.
- Make publishing safe through automated branch, version, and npm-tag checks.

## Branch and npm-tag model

### `main`

- GitHub default branch and current stable source.
- Receives stable fixes and release-lane infrastructure.
- Keeps the existing Changesets release-PR and automatic-publish behavior.
- May publish only stable versions to npm's `latest` tag.
- Must not contain an active Changesets prerelease state.

### `next`

- Development branch for the next breaking release.
- Remains in Changesets prerelease mode with the `next` tag.
- Publishes versions such as `2.0.0-next.0` to npm's `next` tag.
- Upcoming-release feature PRs target this branch.
- Forward merges from `main` synchronize code but do not have to trigger an
  immediate `next` publication. A later ordinary Changeset release may include
  those fixes.

### `<major>.x`

- Maintenance branch for a supported superseded major, such as `1.x`.
- Created from the exact last supported package release tag.
- Receives selected fixes through backport PRs.
- May publish only stable versions whose major matches the branch.
- Must publish with the explicit npm tag `v<major>`, never `latest`.

### PR branches

- May optionally publish Changesets snapshots to the `canary` npm tag.
- Snapshot-generated version changes must never be committed or merged.
- The first publication of a brand-new package may acquire `latest`; this is an
  accepted limitation and does not require extra guard machinery.

## Development flow

1. Upcoming-release features merge into `next`.
2. Stable fixes merge into `main`.
3. Stable fixes are forward-merged from `main` into `next`.
4. `next` is not routinely merged into `main`.
5. Forward-merging a stable fix does not automatically publish `next`. If the
   fix must reach `next` immediately, add a Changeset or manually request a
   prerelease.

## One-button promotion

Promotion should require one manual action and one PR merge:

1. A maintainer presses **Promote next**.
2. Automation verifies that:
   - `main` is contained in `next`;
   - `next` is in prerelease mode with tag `next`;
   - all public package versions agree and have the expected `-next.N` shape;
   - the promotion is pinned to the current `next` commit.
3. Automation creates a temporary promotion branch from that exact commit.
4. On the temporary branch, automation runs:
   - `changeset pre exit`;
   - `pnpm version`, including version synchronization;
   - branch/version/tag guards;
   - build, typecheck, tests, and release verification.
5. Automation opens a stable-version PR from the temporary branch into `main`.
6. The promotion PR must be merged with a merge commit. If `next` advances
   after the promotion branch is generated, the PR must fail verification and
   be regenerated.
7. Merging the PR triggers the existing `main` publication to `latest`.
8. After successful publication, automation verifies npm dist-tags,
   fast-forwards `next` to the released `main`, and immediately runs
   `changeset pre enter next` for the next cycle.

The release workflow needs narrowly scoped permission to update `next` after a
successful stable publication. If branch protection cannot allow that, the
fallback is an automatically generated **Start next cycle** PR.

## Publishing guards

All npm publication must go through one tested entry point.

- `main`: stable versions only, no prerelease state, npm tag `latest`.
- `next`: `-next.N` versions only, prerelease tag and npm tag both `next`.
- `<major>.x`: stable versions only, version major must match the branch, npm
  tag must be exactly `v<major>`.
- Canary: snapshot-shaped versions only, npm tag `canary`, and no Git tags.
- The fixed `@edgestore/*` package group must have matching versions.
- Publishing should fail before contacting npm when branch, version shape,
  prerelease state, or requested npm tag disagree.
- Maintenance publication must record `latest` before publishing and verify
  that it did not change afterward.

## Workflow shape

- Prefer extending the existing release workflow so npm trusted-publishing
  identity remains associated with the same workflow file.
- Run normal Changesets release PRs automatically for `main` and `next`.
- Use guarded `workflow_dispatch` operations for promotion, maintenance, and
  canary releases.
- Serialize npm publication globally so two lanes cannot publish concurrently.
- Keep canary publication manual and run it on an ephemeral worker with
  read-only repository permission plus npm OIDC permission.
- Report the exact package versions published by every lane.

## Maintenance releases

1. Create `<major>.x` from the exact last supported release tag.
2. Backport the fix through a PR.
3. Add a Changeset.
4. Prepare and review the version change.
5. Publish with `--tag v<major>`.
6. Verify that every package's `latest` tag is unchanged.

## Canary releases

The manual canary operation should run:

```sh
changeset version --snapshot canary
changeset publish --tag canary --no-git-tag
```

It must report exact versions, must not push commits or Git tags, and must
discard the generated snapshot changes when the ephemeral job ends.

## Recovery

`RELEASING.md` should document npm dist-tag inspection and repair. Recovery
from an incorrect tag should normally move or remove the dist-tag with
`npm dist-tag`, not unpublish a package.

## Current transition

- Promote the current accumulated canary work as stable `0.8.0`.
- Generate a real stable version by exiting prerelease mode and running the
  repository version command; do not point `latest` at a canary version.
- After `0.8.0` is published and verified, establish `next` from the released
  `main`, enter prerelease mode with tag `next`, and implement the automated
  lane workflows described above.
