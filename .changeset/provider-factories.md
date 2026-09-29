---
'@edgestore/server': major
---

pr: #253

Rename the provider factories: `EdgeStoreProvider()` is now `edgestore()`,
`AWSProvider()` from `providers/aws` is now `s3()` from `providers/s3`, and
`AzureProvider()` from `providers/azure` is now `azureBlob()` from
`providers/azure-blob`.
