---
id: bucket-config
title: Bucket Configuration
sidebar_label: Bucket Config
slug: /bucket-config
---

``` twoslash include context
declare function getUserSession(
  req: any,
): Promise<{ id: string; role: 'admin' | 'user' }>;
// ---cut---
import { initEdgeStore } from '@edgestore/server';
import {
  CreateContextOptions,
  createEdgeStoreNextHandler,
} from '@edgestore/server/adapters/next/app';
import { z } from 'zod';

type Context = {
  userId: string;
  userRole: 'admin' | 'user';
};

async function createContext({ req }: CreateContextOptions): Promise<Context> {
  const { id, role } = await getUserSession(req); // replace with your own session logic

  return {
    userId: id,
    userRole: role,
  };
}

const es = initEdgeStore.context<Context>().create();
```

# Bucket Configuration

## Bucket Types

There are two types of file buckets: `IMAGE` and `FILE`. Both types of buckets work basically the same way, but the `IMAGE` bucket only accepts [certain mime types](#image-bucket-accepted-mime-types).

IMAGE buckets automatically generates a thumbnail version of the image file if the file is bigger than 200px in width or height. In case a thumbnail was generated, the url will be included in the response of the upload request.

## Basic File Validation

You can set the maximum file size and the accepted mime types for every file bucket.

```ts
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket({
    maxSize: 1024 * 1024 * 10, // 10MB
    accept: ['image/jpeg', 'image/png'], // wildcard also works: ['image/*']
  }),
});
```

## Metadata & File Path

Every uploaded file can hold 2 types of data: `metadata` and `path`. you can use this data for access control or for filtering files. The `metadata` and `path` can be generated from the context (`ctx`) or from the `input` of the upload request.

```ts twoslash
// @include: context

const edgeStoreRouter = es.router({
  publicFiles: es
    .fileBucket()
    // this input will be required for every upload request
    .input(
      z.object({
        category: z.string(),
      }),
    )
    // e.g. /publicFiles/{category}/{author}
    .path(({ ctx, input }) => [
      { category: input.category },
      { author: ctx.userId },
    ])
    // this metadata will be added to every file in this bucket
    .metadata(({ ctx, input }) => ({
      userRole: ctx.userRole,
    })),
});

export default createEdgeStoreNextHandler({
  router: edgeStoreRouter,
  /**
   * The context is generated and saved to a cookie
   * in the first load of the page.
   */
  createContext,
});
```

## Lifecycle Hooks

You can use the `beforeUpload` and `beforeDelete` hooks to allow or deny file uploads and deletions. The `beforeDelete` hook must be defined if you want to delete files directly from the client.

```ts twoslash {8-11, 16-19}
// @include: context
// ---cut---
const edgeStoreRouter = es.router({
  publicFiles: es
    .fileBucket()
    /**
     * return `true` to allow upload
     * By default every upload from your app is allowed.
     */
    .beforeUpload(({ ctx, input, fileInfo} ) => {
      console.log('beforeUpload', ctx, input, fileInfo);
      return true; // allow upload
    })
    /**
     * return `true` to allow delete
     * This function must be defined if you want to delete files directly from the client.
     */
    .beforeDelete(({ ctx, fileInfo } ) => {
      console.log('beforeDelete', ctx, fileInfo);
      return true; // allow delete
    }),
});
```

## Access Control (Protected files)



## IMAGE bucket accepted mime types

| mime type |
| --- |
| image/jpeg |
| image/png |
| image/gif |
| image/webp |
| image/svg+xml |
| image/tiff |
| image/bmp |
| image/x-icon |