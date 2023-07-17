```ts twoslash
import { initEdgeStore } from '@edge-store/server';
import { CreateNextContextOptions } from '@edge-store/server/adapters/next';
import { initEdgeStoreClient } from '@edge-store/server/core';
import { z } from 'zod';

type Context = {
  userId: string;
  userRole: 'admin' | 'visitor';
};

function createContext(_opts: CreateNextContextOptions): Context {
  return {
    userId: '123',
    userRole: 'admin',
  };
}

const es = initEdgeStore.context<Context>().create();

// ---cut---
const publicImages = es.imageBucket
  .input(
    z.object({
      type: z.enum(['profile', 'post']),
    }),
  )
  .path(({ ctx, input }) => [
    { author: ctx.userId },
    { type: input.type },
  ])
  .beforeUpload((params) => {
    const { ctx, input, fileInfo } = params;
    //             ^?
    // check if user is allowed to upload here
    return true;
  });
```
