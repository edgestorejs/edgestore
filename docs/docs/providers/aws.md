---
id: aws
title: AWS Provider
sidebar_label: AWS
slug: /providers/aws
---

# AWS Provider

You can also use the Edge Store package with your own AWS S3 bucket. You might want to do that in case you have strict company policies that require you to have all the data in your own AWS account.

You can also use the AWS Provider with other S3 compatible storage services like [Minio](https://min.io/).

By using this provider, you will be able to use most of the basic features of Edge Store. However, for some of the more advanced features like access control with protected files, you will have to create your own infrastructure and logic from scratch.

## Installation

You need to install some peer dependencies to use this provider.

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Then you can set the provider in the router.

```ts twoslash {6, 12}
// @noErrors
import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/pages';
import { AWSProvider } from '@edgestore/server/providers/aws';
import { z } from 'zod';

// ...

export default createEdgeStoreNextHandler<Context>({
  provider: AWSProvider(),
  router: edgeStoreRouter,
  createContext,
});
```

## Options

```ts
export type AWSProviderOptions = {
  /**
   * Access key for AWS credentials.
   * Can also be set via the `ES_AWS_ACCESS_KEY_ID` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  accessKeyId?: string;
  /**
   * Secret access key for AWS credentials.
   * Can also be set via the `ES_AWS_SECRET_ACCESS_KEY` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  secretAccessKey?: string;
  /**
   * AWS region to use.
   * Can also be set via the `ES_AWS_REGION` environment variable.
   */
  region?: string;
  /**
   * Name of the S3 bucket to use.
   * Can also be set via the `ES_AWS_BUCKET_NAME` environment variable.
   */
  bucketName?: string;
  /**
   * Custom endpoint for S3-compatible storage providers (e.g., MinIO).
   * Can also be set via the `ES_AWS_ENDPOINT` environment variable.
   */
  endpoint?: string;
  /**
   * Force path style for S3-compatible storage providers.
   * Can also be set via the `ES_AWS_FORCE_PATH_STYLE` environment variable.
   * Defaults to false for AWS S3, but should be true for most S3-compatible providers.
   */
  forcePathStyle?: boolean;
  /**
   * Base URL to use for accessing files.
   * Only needed if you are using a custom domain or cloudfront.
   *
   * Can also be set via the `EDGE_STORE_BASE_URL` environment variable.
   */
  baseUrl?: string;
  /**
   * Secret to use for encrypting JWT tokens.
   * Can be generated with `openssl rand -base64 32`.
   *
   * Can also be set via the `EDGE_STORE_JWT_SECRET` environment variable.
   */
  jwtSecret?: string;
};
```

## Using with Minio

You can use the AWS Provider with Minio or other S3-compatible storage providers by setting the `endpoint` and `forcePathStyle` options.

```ts
provider: AWSProvider({
  endpoint: 'http://localhost:9000', // can be set via the `ES_AWS_ENDPOINT` environment variable
  forcePathStyle: true, // can be set via the `ES_AWS_FORCE_PATH_STYLE` environment variable
}),
```