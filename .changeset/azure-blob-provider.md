---
'@edgestore/server': major
---

pr: #194

Sign short-lived, blob-scoped Azure upload and read URLs on the server with
the storage account key. Set `storageAccountKey` or `ES_AZURE_ACCOUNT_KEY` in
place of `sasToken` or `ES_AZURE_SAS_TOKEN`. Azure Blob Storage does not
support `temporary` or `replaceTargetUrl`.
