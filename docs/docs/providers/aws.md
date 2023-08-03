---
id: aws
title: AWS Provider
sidebar_label: AWS
slug: /providers/aws
---

# AWS Provider

## Environment Variables

### S3 Bucket (required)

```shell
ES_AWS_BUCKET_NAME=my-bucket-name
ES_AWS_REGION=us-east-1
```

### Custom URL (optional)

If you have a cloudfront distribution set up, or a custom domain, you can pass the URL to the provider.

```shell
EDGE_STORE_BASE_URL=https://xxxxxxxxxxxxx.cloudfront.net
```

### Credentials (optional)

You can pass the credentials to the AWS provider using environment variables.
These are optional, and if not provided, the provider will attempt to use the default credentials chain.

```shell
ES_AWS_ACCESS_KEY_ID=my-access-key-id
ES_AWS_SECRET_ACCESS_KEY=my-secret-access-key
```

## Configuration

All you need to do is pass the provider to the `EdgeStore` function.
You can also pass a config object to the provider, which will have precedence over the environment variables.

```js title="pages/api/edgestore/[...edgestore].ts"
import EdgeStore from '@edgestore/react/next';
import { AWSProvider } from '@edgestore/react/providers';

export default EdgeStore({
  provider: AWSProvider(),
});
```

## Provider Options

### createContext

Type: `(params: { req: NextApiRequest; res: NextApiResponse; }) => C | Promise<C>`

You can pass a function to create a context object that will be passed to the other functions on the provider.

### pathPrefix

Type: `(params: { req: NextApiRequest; res: NextApiResponse; ctx: C; }) => string | Promise<string>`

You can pass a function to create a path prefix for the upload URL.

### onRequestUpload

Type: `(params: { req: NextApiRequest; res: NextApiResponse; ctx: C; fileInfo: { key: string; size: number; }; }) => void | Promise<void>`

You can pass a function that will be called before returning the upload URL.

### accessKeyId

Type: `string`

The access key id for your AWS account. Does the same thing as the `ES_AWS_ACCESS_KEY_ID` environment variable.

### secretAccessKey

Type: `string`

The secret access key for your AWS account. Does the same thing as the `ES_AWS_SECRET_ACCESS_KEY` environment variable.

### region

Type: `string`

The region of your S3 bucket. Does the same thing as the `ES_AWS_REGION` environment variable.

### bucketName

Type: `string`

The name of your S3 bucket. Does the same thing as the `ES_AWS_BUCKET_NAME` environment variable.
