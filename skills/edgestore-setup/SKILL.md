---
name: edgestore-setup
description: Use when adding, extending, or troubleshooting EdgeStore file uploads, upload UI, or bucket access policies in a TypeScript/React application. Not for unrelated storage migrations or account administration.
license: MIT
---

# EdgeStore setup

Implement uploads through the application's UI and server route. Verify the upload
and retrieval there; if runtime access is unavailable, report what remains untested.

## Establish the application and API version

Use `edgestore --cwd <app> agent context --json` when the CLI is available. Otherwise
inspect the selected workspace's manifests, installed EdgeStore package metadata,
existing routes/provider, and backend env-file convention. In a monorepo identify
the frontend and backend separately. Use the app's package versions, not the CLI's.

Read the relevant installed `@edgestore/server`, `@edgestore/react`, or
`@edgestore/sdk` `agent-docs/README.md` and follow its local references. These
belong to the installed package version; the skill and CLI can be newer. If the
reference is absent, use installed types/source and version-matched documentation,
and mention the fallback. Read the references again after installing packages.

For an existing 0.2 integration, resolve maintenance versus migration with the
user before changing APIs. Preserve installed versions unless an upgrade is
authorized. For missing packages choose a compatible, explicit version. Use a
prerelease only when requested or required by the application.

## Choose the integration

Reuse the app's architecture, existing buckets, and configured storage provider.
Read the matching installed server reference: `next.md` (App or Pages Router),
`tanstack-start.md`, `remix.md` (Remix or React Router framework mode), `astro.md`,
`hono.md`, `express.md`, or `fastify.md`. Check the app's routing convention and
framework version before adapting examples. A React Router client-side app still
needs a backend. Reuse the existing backend or ask which one to add. Preserve S3,
Azure, and custom providers rather than provisioning hosted EdgeStore resources.

Infer a bucket name from the application's feature (for example avatars or
attachments); fall back to `publicFiles` when context is insufficient. Infer public
versus protected access from the application and disclose the decision in the
initial implementation plan or after implementation. Ask when the access policy
is ambiguous or the files may be sensitive. Configure the application's
authorization rules for protected files.

Before provisioning, know the selected app/backend, intended provider, account,
project, bucket identity, access policy, and env destination. Reuse an existing env
file when the backend already loads it; otherwise use the framework's convention.
Preserve existing env values.

## Use MCP and the CLI

Prefer an available MCP for an action it supports; otherwise use the CLI if
available. Start with read-only discovery and request only the permissions needed.
If authentication requires the user, explain the sign-in step and continue local work.

Creating resources requires authorization for that setup. A project already
created through MCP should be linked locally, not created again through CLI.
After an uncertain mutation result, inspect for the resource before retrying or
switching tools. Do not delete/empty buckets, revoke keys, enable billable overage, or
change unrelated resources as an implicit setup step.

For hosted provisioning or credential delivery, read
[references/hosted-setup.md](references/hosted-setup.md).

## Implement and verify

Configure the backend router/provider and the matching client endpoint using
installed references. Keep server keys in a loaded, gitignored backend env file,
not frontend variables (`VITE_*`, `NEXT_PUBLIC_*`).
In split workspaces, export the real backend router type and import it with
`import type` on the frontend. For cross-origin calls, configure CORS for the
intended frontend origin. Wrap the upload UI with the React provider.

For a failing integration, read the installed server's `troubleshooting.md` and
the React package's `errors.md`. Diagnose the failing app request before changing
remote resources or credentials.

Run `edgestore --cwd <app> doctor --offline` when available, plus the app's own
typecheck/build/tests. Investigate doctor warnings and skipped checks. Start the
app, upload a small test file through its UI and server route, and independently
retrieve and check the bytes.
For protected access, verify unauthenticated retrieval is denied and authorized
retrieval works.

Use the account and project authorized for testing. Keep credentials and signed
URLs out of agent output; retrieve protected files in a local process that returns
only the result. Clean up only this task's test resources. Summarize the integration
choices, checks performed, blockers, and any test resources left behind.
