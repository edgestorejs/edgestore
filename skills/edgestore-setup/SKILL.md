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

For an existing 0.x integration, resolve maintenance versus migration with the
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
versus protected access from the application. Ask when the access policy is
ambiguous or the files may be sensitive. Configure the application's authorization
rules for protected files.

Before changing configuration or provisioning, summarize the proposed setup for
approval: app/backend, provider, account/project to create or reuse, bucket name,
who can access files, upload limits, and env destination. Proceed once approved;
ask again only if the plan materially changes. Reuse an existing env file when
the backend already loads it; otherwise use the framework's convention. Preserve
existing env values.

## Use MCP and the CLI

Prefer an available MCP for an action it supports; otherwise use the CLI.
For hosted setup, complete authentication, project linking, and credential
delivery as part of the task. When the CLI is needed but missing, install or
invoke `@edgestore/cli` with the application's package manager using the version
guidance above. Start with read-only discovery.
When sign-in is needed, initiate it with the available tooling, ask the user to
complete the browser step, then resume setup and verification.

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
Treat credentials as required configuration. Do not add conditional providers,
upload-enable flags, or disabled setup placeholders merely because authentication
is pending. Finish setup instead; preserve optional-storage behavior only when
the application requires it.
In split workspaces, export the real backend router type and import it with
`import type` on the frontend. For cross-origin calls, configure CORS for the
intended frontend origin. Wrap the upload UI with the React provider.

Implement upload UI as a reusable component, reusing the app's components or
adapting the React package's component references. For attachments, provide
drag-and-drop and file selection with a file list. For profiles or compact forms,
choose an avatar picker, file field, or upload button as appropriate.
If the installed references are absent, see the
[Dropzone](https://edgestore.dev/docs/components/dropzone.md),
[Multi-file uploader](https://edgestore.dev/docs/components/multi-file.md),
[Avatar](https://edgestore.dev/docs/components/avatar.md),
[File field](https://edgestore.dev/docs/components/file-field.md),
[Upload button](https://edgestore.dev/docs/components/upload-button.md), and
[Uploader provider](https://edgestore.dev/docs/components/uploader-provider.md) guides.
Use the docs origin recorded in the installed references for these online guides.
Adapt the examples to the installed APIs and app styling; do not introduce a new
styling system just to use them. For custom dropzones, prefer `react-dropzone`
with accessible file selection, progress, and error feedback.

For uploads in unsaved forms, use temporary files when supported: upload, save
the record, then confirm. A failed database save must leave the files temporary.
Persist the upload result's ID/key and URL directly. Do not add a backend `get()`
just to recheck the uploaded URL or size: it can return 404 while processing is
pending. Validate input and authorize attachments in the app; fetch authoritative
metadata only when the feature needs it. Wait for processing only when processed
details are needed immediately, using the installed API's opt-in support.

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
