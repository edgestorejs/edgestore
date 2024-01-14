---
id: s3-api
title: S3 API
sidebar_label: S3 API
slug: /providers/s3-api
---

# S3 API Provider

Over the past two decades, S3 has become one of the most popular storage services on the internet. This has caused non-AWS storage providers to support the S3 APIs. Now, you can use the Edge Store package with any storage provider that supports the S3 APIs.

By using this provider, you will be able to use most of the basic features of Edge Store. However, for some of the more advanced features like access control with protected files, you will have to create your own infrastructure and logic from scratch.

## Installation

You need to install some peer dependencies to use this provider.

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Then you can set the provider in the router.

```ts twoslash {7, 13}
// @noErrors
import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/pages';
import { S3APIProvider } from '@edgestore/server/providers/s3-api';
import { z } from 'zod';

// ...

export default createEdgeStoreNextHandler<Context>({
  provider: S3APIProvider(),
  router: edgeStoreRouter,
  createContext,
});
```

## Options

```ts
export type S3APIProviderOptions = {
  /**
   * Access key for S3 Storage compatible credentials.
   * Can also be set via the `ES_S3API_ACCESS_KEY_ID` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  accessKeyId?: string;
  /**
   * Secret access key for S3 Storage compatible credentials.
   * Can also be set via the `ES_S3API_SECRET_ACCESS_KEY` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  secretAccessKey?: string;
  /**
   * S3 Storage compatible region to use.
   * Can also be set via the `ES_S3API_REGION` environment variable.
   */
  region?: string;
  /**
   * Name of the S3 Storage compatible bucket to use.
   * Can also be set via the `ES_S3API_BUCKET_NAME` environment variable.
   */
  bucketName?: string;
  /**
   * Custom endpoint to use for S3 Storage compatible API.
   * Can also be set via the `ES_S3API_ENDPOINT` environment variable.
   */
  endpoint?: string;
  /**
   * Base URL to use for accessing files.
   * Only needed if you are using a custom domain or cloudfront.
   *
   * Can also be set via the `EDGE_STORE_PUBLIC_URL` environment variable.
  */
  publicUrl?: string;
  /**
   * Secret to use for encrypting JWT tokens.
   * Can be generated with `openssl rand -base64 32`.
   *
   * Can also be set via the `EDGE_STORE_JWT_SECRET` environment variable.
   */
  jwtSecret?: string;
};
```
