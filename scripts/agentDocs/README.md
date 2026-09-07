# Package agent references

Author API guidance in `docs/content/docs/`. `selection.ts` chooses the pages and
sections shipped with server, React, and SDK packages. Generated `agent-docs/`
directories are ignored by Git and included in npm tarballs.

Run `pnpm agent-docs:build` to regenerate all references, `pnpm agent-docs:check`
to detect stale/missing artifacts, and `pnpm agent-docs:test` for renderer tests.
Package builds and prepack hooks regenerate their own references. No docs site
build, credentials, network fetch, or MDX execution is involved.

Run `pnpm build && pnpm agent-docs:pack-check` to inspect real npm tarballs on
macOS/Linux (requires `tar`). It verifies every generated file byte-for-byte,
the index links, and the presence of compiled runtime entrypoints. Temporary
tarballs are removed after the check.

For API changes, update the authored docs in the same PR and adjust the selection
if needed. Section selection fails when a selected heading is missing or ambiguous.
Unsupported MDX fails rather than silently losing instructions. Add a tested
conversion only when a selected page needs it; do not evaluate arbitrary MDX.

The generated index identifies the exact package version. Source links are online
navigation aids, not a claim that moving online documentation is version-pinned.
Read references relative to the application's installed package metadata, never
relative to a global CLI's dependency tree.
