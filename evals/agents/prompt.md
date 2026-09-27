Implement a public file-sharing upload page in this application using the hosted EdgeStore provider. Use the exact local packages listed below, not a registry release. Keep the existing framework and project structure.

Provide a file input with accessible label "Choose file", an "Upload" button, upload progress, and useful errors. After success show a link whose accessible name is the uploaded filename. Use a file bucket called `evaluationFiles`; files in this evaluation are intentionally public. Keep the frontend typed against the real backend router, with type-only server imports. Do not substitute a CLI or SDK script for the application's upload flow.

Implement and check everything possible locally. No hosted account, project, or credential is available during this coding run: do not log in, provision remote resources, invent credentials, or read the user's other workspaces/configuration. The operator will provide backend-only environment variables after the coding session for live testing. Do not claim an upload succeeded before that separate test.

Use the installed CLI through `node <local packed CLI path>` for local context and offline diagnostics if useful. Preserve the supplied framework pins and EdgeStore tarball overrides. Run the application's build and typecheck, and explain what is complete and what still needs live verification.
