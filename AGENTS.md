# AGENTS.md

## Project

- This is a pnpm/Turbo TypeScript monorepo.
- Workspaces live in `packages/*`, `docs`, and `examples/*`.
- Core packages are `@edgestore/server`, `@edgestore/react`, and
  `@edgestore/shared`.

## Setup

- Use Node.js `>=24`.
- Install dependencies with `pnpm install`.
- Prefer existing workspace scripts over ad hoc commands.

## Common Commands

- Build packages: `pnpm build`
- Build everything: `pnpm build:all`
- Typecheck packages: `pnpm typecheck`
- Test packages: `pnpm test`
- Type tests: `pnpm test:types`
- Lint: `pnpm lint`
- Format check: `pnpm format --check`
- Docs dev server: `pnpm docs:dev`

For focused work, prefer Turbo or pnpm filters, for example:
`pnpm turbo run test --filter=@edgestore/server`.

## Changesets

- Any PR that changes published `@edgestore/*` behavior or public APIs must
  include a changeset.
- Use `patch` for fixes, `minor` for backward-compatible features, and `major`
  for breaking changes.
- Changes limited to tests, docs, examples, or internal tooling do not need one.

## Review guidelines

- Prioritize structural issues over style nits.
- Look for simpler designs that delete branching, indirection, or special cases.
- Flag ad-hoc conditionals, leaky boundaries, unnecessary wrappers, and
  cast-heavy types when they make code harder to reason about.
- Keep feedback direct, actionable, and focused on maintainability.

## Git

- Avoid commands that rewrite history, such as `git rebase`, `git commit --amend`, and force-pushes, unless explicitly asked.
