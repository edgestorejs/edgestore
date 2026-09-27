---
'@edgestore/server': major
'@edgestore/shared': major
'@edgestore/react': patch
---

Bring the Azure Blob provider to parity with S3. Large browser uploads use
block uploads with signed, object-scoped sessions: the browser stages blocks
through short-lived Put Block URLs, and the provider checks every block's size
before committing. Backend uploads are available through the router client,
files can be referenced by `{ key }` as well as by URL, and uploads accept a
`path` callback and `objectOptions` (cache control, content disposition, and
metadata).

Breaking changes to `azureBlob()`: `customBaseUrl` / `ES_AZURE_BASE_URL` is
replaced by `endpoint` / `ES_AZURE_ENDPOINT`, with a separate `baseUrl` for file
URLs. Credentials are checked on first use instead of when the provider is
created. Upload responses include a signed read URL only when the private
bucket sets `autoSignedUrls`, and cookie-based access-control rules are
rejected at initialization.

Multipart part ETags are optional in the provider contract, so storage that
returns none can complete uploads. S3 and the hosted provider reject missing
ETags with an actionable error.
