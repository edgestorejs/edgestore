---
id: edgestore
title: EdgeStore Provider
sidebar_label: EdgeStore
slug: /providers/edgestore
---

# EdgeStore Provider

You can optionally pass in a provider to the `createEdgeStoreNextHandler` function. This is useful if you want to use a different provider than the default one or if you want to pass some custom options to the provider.

The EdgeStore Provider is the default provider. If you followed the documentation, you already have it configured in your app.

```ts twoslash {6, 12}
// @noErrors
import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/pages';
import { EdgeStoreProvider } from '@edgestore/server/providers/edgestore';
import { z } from 'zod';

// ...

export default createEdgeStoreNextHandler<Context>({
  provider: EdgeStoreProvider(), // this is the default provider and can be omitted
  router: edgeStoreRouter,
  createContext,
});
```

## Options

```ts
export type EdgeStoreProviderOptions = {
  /**
   * Access key for your EdgeStore project.
   * Can be found in the EdgeStore dashboard.
   *
   * This can be omitted if the `EDGE_STORE_ACCESS_KEY` environment variable is set.
   */
  accessKey?: string;
  /**
   * Secret key for your EdgeStore project.
   * Can be found in the EdgeStore dashboard.
   *
   * This can be omitted if the `EDGE_STORE_SECRET_KEY` environment variable is set.
   */
  secretKey?: string;
};
```
