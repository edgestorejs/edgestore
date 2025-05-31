---
id: utils
title: Utils
sidebar_label: Utils
slug: /utils
---

## Download links

Sometimes the browser shows the file directly in the browser instead of downloading it. To force the browser to download the file, you can use the `getDownloadUrl` function.

```ts
import { getDownloadUrl } from '@edgestore/react/utils';

getDownloadUrl(
  url, // the url of the file
  'overwrite-file-name.jpg', // optional, the name of the file to download
);
```

## Format file size

You might want to display the file size in a human-readable format. You can use the `formatFileSize` function to do that.

```ts
import { formatFileSize } from '@edgestore/react/utils';

formatFileSize(10485760); // => 10MB
```
