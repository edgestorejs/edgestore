---
sidebar_position: 1
title: Edge Store
---

# Edge Store Provider

## Environment Variables

### Credentials (required)

```shell title=".env"
EDGE_STORE_ACCESS_KEY=your-access-key
EDGE_STORE_SECRET_KEY=your-secret-key
```

## Configuration

The Edge Store provider is the default provider, so you don't need to pass it to the `EdgeStore` function.

```jsx title="pages/api/edgestore/[...edgestore].ts"
import EdgeStore from '@edge-store/react/next';

export default EdgeStore();
```
