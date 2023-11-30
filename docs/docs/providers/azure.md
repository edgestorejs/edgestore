---
id: azure
title: Azure Provider
sidebar_label: Azure
slug: /providers/azure
---

# Azure Provider

You can also use the Edge Store package with your own Azure Blob Storage. You might want to do that in case you have strict company policies that require you to have all the data in your own Azure account.

By using this provider, you will be able to use most of the basic features of Edge Store. However, for some of the more advanced features like access control with protected files, you will have to create your own infrastructure and logic from scratch.

## Installation

You need to install some peer dependencies to use this provider.

```bash
npm install @azure/storage-blob
```

Then you can set the provider in the router.

```ts twoslash {7, 13}
// @noErrors
import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/pages';
import { AzureProvider } from '@edgestore/server/providers/azure';
import { z } from 'zod';

// ...

export default createEdgeStoreNextHandler<Context>({
  provider: AzureProvider(),
  router: edgeStoreRouter,
  createContext,
});
```

## Options

```ts
export type AzureProviderOptions = {
  /**
   * The storage account name for Azure Blob Storage
   * Can also be set via the `ES_AZURE_ACCOUNT_NAME` environment variable.
   */
  storageAccountName?: string;
  /**
   * SAS token for Azure Blob Storage
   * Can also be set via the `ES_AZURE_SAS_TOKEN` environment variable.
   */
  sasToken?: string;
  /**
   * Azure Blob Storage container name
   * Can also be set via the `ES_AZURE_CONTAINER_NAME` environment variable.
   */
  containerName?: string;
};
```
