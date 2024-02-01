---
id: logging
title: Logging
sidebar_label: Logging
slug: /logging
---

# Logging

The Edge Store package outputs some logs on the server-side. You can configure the log level by passing the `logLevel` option when creating the api handler. You can set it to `debug` to see in more details what is happening in the server.

```ts
const handler = createEdgeStoreNextHandler({
  logLevel: 'debug', // optional. defaults to 'error' in production and 'info' in development
  router: edgeStoreRouter,
});
```

## Log Levels

- `debug`
- `info`
- `warn`
- `error`
- `none`