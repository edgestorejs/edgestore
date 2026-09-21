<h1 align="center">
  <a href="https://edgestore.dev"><img src="docs/public/img/logo.png" alt="EdgeStore home" width="48" height="48" align="middle" /></a>
  <a href="https://edgestore.dev"><picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/public/img/edgestore.svg" />
      <img src="docs/public/img/edgestore-light.svg" alt="EdgeStore" width="240" align="middle" />
  </picture></a>
</h1>

<p align="center">Type-safe file uploads for TypeScript and React.</p>

<p align="center">
  <a href="https://edgestore.dev">Website</a> ·
  <a href="https://edgestore.dev/docs/quick-start">Documentation</a> ·
  <a href="https://dashboard.edgestore.dev">Dashboard</a> ·
  <a href="https://discord.gg/HvrnhRTfgQ">Discord</a>
</p>

## What is EdgeStore?

EdgeStore connects your upload UI to your backend with end-to-end type safety.
Define file validation, metadata, and authorization in your server router, then
upload and manage files from React with types inferred from that router.

Use [EdgeStore's hosted storage](https://edgestore.dev/docs/providers/edgestore)
for managed file delivery and access control, or connect your own
[S3-compatible storage](https://edgestore.dev/docs/providers/s3) or
[Azure Blob Storage](https://edgestore.dev/docs/providers/azure-blob).

## Use with an agent

Give your coding agent this prompt:

```text
Read https://edgestore.dev/SKILL.md and add file uploads to this application.
```

For skills, plugins, and MCP connections, see [agent setup](https://edgestore.dev/docs/agents).

## Documentation

- [Quick start](https://edgestore.dev/docs/quick-start)
- Framework guides: [Next.js](https://edgestore.dev/docs/adapters/next), [TanStack Start](https://edgestore.dev/docs/adapters/tanstack-start), [Remix / React Router](https://edgestore.dev/docs/adapters/remix), [Astro](https://edgestore.dev/docs/adapters/astro), [Hono](https://edgestore.dev/docs/adapters/hono), [Express](https://edgestore.dev/docs/adapters/express), and [Fastify](https://edgestore.dev/docs/adapters/fastify)
- [Upload components](https://edgestore.dev/docs/components/multi-file)
- [Example applications](./examples)

## Community

Questions and ideas are welcome on [Discord](https://discord.gg/HvrnhRTfgQ).
For bugs and contributions, [open an issue](https://github.com/edgestorejs/edgestore/issues)
or [submit a pull request](https://github.com/edgestorejs/edgestore/pulls).

[Release notes](https://github.com/edgestorejs/edgestore/releases) · [MIT license](./LICENSE)
