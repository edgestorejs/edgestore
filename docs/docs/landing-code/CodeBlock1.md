```ts twoslash
import { initEdgeStore } from '@edgestore/server';
import { CreateContextOptions } from '@edgestore/server/adapters/next/pages';
import { initEdgeStoreClient } from '@edgestore/server/core';
import { z } from 'zod';

type Context = {
  userId: string;
  userRole: 'admin' | 'visitor';
};

function createContext(_opts: CreateContextOptions): Context {
  return {
    userId: '123',
    userRole: 'admin',
  };
}

const es = initEdgeStore.context<Context>().create();

// ---cut---
const publicImages = es
  .imageBucket()
  .input(
    z.object({
      type: z.enum(['profile', 'post']),
    }),
  )
  .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
  .beforeUpload((params) => {
    const { ctx, input, fileInfo } = params;
    //             ^?
    // check if user is allowed to upload here
    return true;
  });
```
