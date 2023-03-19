---
sidebar_position: 2
title: AWS
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
import EdgeStore from "@edge-store/react/next";
import { AWSProvider } from "@edge-store/react/providers";

export default EdgeStore({
  provider: AWSProvider(),
});
```
