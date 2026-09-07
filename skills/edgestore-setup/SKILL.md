---
name: edgestore-setup
description: Set up or extend EdgeStore file uploads in a TypeScript/React application. Use for an EdgeStore integration, upload UI, or bucket access policy; not unrelated storage migrations or account administration.
license: MIT
---

# EdgeStore setup

Deliver an integration that uploads through the application's own UI and server
route, then independently retrieves the file. A configured MCP, CLI upload, or
green health check does not establish that outcome. If runtime access is missing,
finish the safe local work and clearly distinguish it from end-to-end completion.

## Establish the application and API version

Use `edgestore --cwd <app> agent context --json` when the CLI is available. Otherwise
inspect the selected workspace's manifests, installed EdgeStore package metadata,
existing routes/provider, and backend environment-file convention without loading
application modules or printing env contents. In a monorepo identify the frontend
and backend separately; do not use the CLI's dependencies as the app's versions.

Read the relevant installed `@edgestore/server`, `@edgestore/react`, or
`@edgestore/sdk` **`agent-docs/README.md`** and follow its local references. These
belong to the installed package version; the skill and CLI can be newer. If the
bundle is absent, use installed types/source plus documentation matching the
version, and disclose the fallback. Before a new v1 prerelease installation, use
[preview guidance](https://next.edgestore.dev/docs/agents). A moving preview is not
an exact-version reference. Read the references again after installing packages.

For an existing 0.2 integration, resolve maintenance versus migration with the
user before changing APIs. Do not silently upgrade it, combine API generations,
or assume unsupported future versions work. Preserve installed versions unless
the requested implementation requires and authorizes a change. For missing
packages choose a compatible, explicit version/release lane; do not assume the
registry's default tag matches this prerelease workflow.

## Choose the integration

Reuse the app's architecture, existing buckets, and configured storage provider.
The initial supported setup paths are Next.js App Router, TanStack Start, and a
Vite frontend with an existing or explicitly chosen Hono backend. Consult the
installed adapter reference for route syntax. Do not add Hono just because an app
uses Vite/React. Preserve Pages Router, S3, Azure, and custom-provider integrations;
they are not a request to provision hosted infrastructure.

Infer a bucket name from the application's feature (for example avatars or
attachments); fall back to `publicFiles` when context is insufficient. Infer public
versus protected access from the application and disclose the decision in the
initial implementation plan or after implementation. Ask when the access policy
is ambiguous or the files may be sensitive. Public files are publicly readable;
protected files need the application's authorization rules, not just a different
bucket label.

Before provisioning, know the selected app/backend, intended provider, account,
project, bucket identity, access policy, and env destination. Reuse an existing env
file when the backend already loads it; otherwise choose and wire the framework's
appropriate convention. Do not overwrite existing values or create a second env
file merely to follow an example.

## Use remote tools and local credentials deliberately

Prefer an available MCP for an action it supports; otherwise use the CLI if
available. Inspect each tool's actual capabilities and granted scopes. Start with
read-only discovery, request only the additional permissions needed, and do not
approve broad consent merely because the client requests it. If authentication
requires the user, explain what they need to do and continue independent local work.

Creating resources requires authorization for that setup. A project already
created through MCP should be linked locally, not created again through CLI.
After an uncertain mutation result, inspect for the resource before retrying or
switching transports. Never repeat a mutation through both tools to satisfy a
checklist. Do not delete/empty buckets, revoke keys, enable billable overage, or
change unrelated resources as an implicit setup step.

For hosted provisioning or credential delivery, read
[references/hosted-setup.md](references/hosted-setup.md). CLI linking and protected
file delivery cover the local actions the hosted MCP cannot perform. If no safe
tool path exists, ask the user to complete it; never ask them to paste a secret
into the conversation.

## Implement and verify

Configure the backend router/provider and the matching client endpoint using
installed references. Keep server keys in a loaded, gitignored backend env file,
never frontend variables (`VITE_*`, `NEXT_PUBLIC_*`), source literals, or transcripts.
In split workspaces, export the real backend router type and import it with
`import type` on the frontend; do not fabricate a matching client-only router or
bundle backend runtime imports. For cross-origin calls, narrowly configure CORS
for the intended frontend and EdgeStore route; do not reflect arbitrary origins
with credentials. Check the React provider actually wraps the upload UI.

Run `edgestore --cwd <app> doctor --offline` when available, plus the app's own
typecheck/build/tests. Treat doctor warnings and skips as unresolved observations,
not proof of correct routing. Start the app, upload a small harmless test file
through its UI and server route, and independently retrieve and check the bytes.
For protected access, verify unauthenticated retrieval is denied and authorized
retrieval works, without printing signed URLs. Do not substitute a CLI/SDK-only
upload for the app path.

Use only the account/environment authorized for testing. A docs preview is not a
non-production API. Keep credentials and signed URLs out of logs, tool results,
screenshots, and the final response; perform sensitive retrieval in a local
process that returns only the verification result. Clean up only exact test
resources within authorized scope. Explain the integration choices, verification
that actually ran, remaining blockers, and any test resources left behind in the
format that best fits the task.
