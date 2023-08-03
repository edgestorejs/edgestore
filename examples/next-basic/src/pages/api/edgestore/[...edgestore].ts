import { initEdgeStore } from '@edgestore/server';
import {
  CreateContextOptions,
  createEdgeStoreNextHandler,
} from '@edgestore/server/adapters/next/pages';
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

const imagesBucket = es.imageBucket
  .input(
    z.object({
      type: z.enum(['profile', 'post']),
      extension: z.string().optional(),
    }),
  )
  .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
  .metadata(({ ctx, input }) => ({
    extension: input.extension,
    role: ctx.userRole,
  }))
  .beforeUpload(({ ctx, input }) => {
    console.log(ctx, input);
    return true;
  });

const filesBucket = es.fileBucket
  .path(({ ctx }) => [{ author: ctx.userId }])
  .metadata(({ ctx }) => ({
    role: ctx.userRole,
  }))
  .accessControl({
    OR: [
      {
        userId: { path: 'author' }, // this will check if the userId is the same as the author in the path parameter
      },
      {
        userRole: 'admin', // this is the same as { userRole: { eq: "admin" } }
      },
    ],
  });

const edgeStoreRouter = es.router({
  images: imagesBucket,
  files: filesBucket,
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

export default createEdgeStoreNextHandler<Context>({
  router: edgeStoreRouter,
  createContext,
});
