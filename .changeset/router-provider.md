---
'@edgestore/server': major
---

pr: #253

Configure the provider once on the router with
`es.router({ ... }).provider(...)`, and pass only the `router` to adapters. The
hosted provider is the default. Use `router.client` in place of
`initEdgeStoreClient`.

Providers are now created with `edgestore()`, `s3()` from
`@edgestore/server/providers/s3` (was `AWSProvider` from `providers/aws`), and
`azureBlob()` from `@edgestore/server/providers/azure-blob` (was
`AzureProvider` from `providers/azure`). The hosted provider also accepts a
Bearer `token` with an explicit `project`.
