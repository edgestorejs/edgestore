---
'@edgestore/server': major
---

pr: #262

Sign Azure Blob URLs with the storage account key: set `storageAccountKey` or
`ES_AZURE_ACCOUNT_KEY` in place of `sasToken` or `ES_AZURE_SAS_TOKEN`. Replace
`customBaseUrl` and `ES_AZURE_BASE_URL` with `endpoint` and `ES_AZURE_ENDPOINT`.
Azure Blob rejects `temporary`, `replaceTargetUrl`, and cookie-based
`accessControl` rules.
