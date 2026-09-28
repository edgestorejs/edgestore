---
'@edgestore/server': major
---

pr: #262

Rebuild the Azure Blob provider. It signs short-lived, blob-scoped upload and
read URLs with the storage account key: set `storageAccountKey` or
`ES_AZURE_ACCOUNT_KEY` in place of `sasToken` or `ES_AZURE_SAS_TOKEN`.
`customBaseUrl` and `ES_AZURE_BASE_URL` are replaced by `endpoint` and
`ES_AZURE_ENDPOINT`, with a separate `baseUrl` for file URLs. Credentials are
checked on first use.

Large browser uploads use block uploads with signed, object-scoped sessions.
The provider also supports backend uploads, `{ key }` file references, a `path`
callback, and `objectOptions` (cache control, content disposition, and
metadata). Upload responses include a signed read URL only when a private
bucket sets `autoSignedUrls`. Azure Blob Storage does not support `temporary`
or `replaceTargetUrl`, and rejects cookie-based `accessControl` rules at
initialization.
