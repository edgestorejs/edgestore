---
'@edgestore/cli': major
---

pr: #168

Introduce the `edgestore` CLI. It supports browser and device-code OAuth login;
management of accounts, projects, members, buckets, files, project keys, and
tokens; concurrent uploads with progress; guided `init`; coding-agent setup for
Codex, Claude Code, and Cursor; shell completion; and `doctor` diagnostics.
Project credential output and diagnostics use `EDGESTORE_ACCESS_KEY` and
`EDGESTORE_SECRET_KEY`.
Requires Node.js 22.22.0 or newer.
