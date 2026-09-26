import { createEdgeStoreProvider } from '@edgestore/react';
import { initEdgeStore } from '@edgestore/server';
import * as server from '@edgestore/server';
import { createEdgeStoreExpressHandler } from '@edgestore/server/adapters/express';
import { createEdgeStoreFastifyHandler } from '@edgestore/server/adapters/fastify';
import { createEdgeStoreHonoHandler } from '@edgestore/server/adapters/hono';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { createEdgeStoreNextHandler as createPagesHandler } from '@edgestore/server/adapters/next/pages';
import { createEdgeStoreRemixHandler } from '@edgestore/server/adapters/remix';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import * as core from '@edgestore/server/core';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { s3 } from '@edgestore/server/providers/s3';
import { expectError, expectType } from 'tsd';
import { z } from 'zod';

expectError(server.createEdgeStore);
expectError(core.createEdgeStore);
expectError(core.createBackendClient);

const es = initEdgeStore.context<{ userId: string }>().create();
const router = es.router({
  files: es
    .fileBucket()
    .input(z.object({ category: z.enum(['post', 'profile']) }))
    .path(({ ctx, input }) => [
      { user: ctx.userId },
      { category: input.category },
    ]),
});
const input = {
  content: 'hello',
  ctx: { userId: 'user' },
  input: { category: 'post' as const },
};
void router.client.files.upload(input).then((file) => {
  expectType<string>(file.path.user);
  expectType<string>(file.path.category);
});
expectError(
  router.client.files.upload({ content: 'missing context and input' }),
);
expectError(
  router.client.files.upload({ ...input, input: { category: 'invalid' } }),
);

const s3Router = router.provider(s3());
expectError(s3Router.client.files.upload);
expectError(s3Router.client.files.list);
expectError(s3Router.client.files.confirm);
void s3Router.client.files.get({ url: 'https://files.example.com/file' });
void router.client.files.upload(input);
const hostedAgain = s3Router.provider(edgestore());
void hostedAgain.client.files.upload(input);

const { useEdgeStore } = createEdgeStoreProvider<typeof s3Router>();
const { edgestore: frontend } = useEdgeStore();
void frontend.files.upload({
  file: new File([], 'file.txt'),
  input: { category: 'post' },
});
expectError(
  frontend.files.upload({
    file: new File([], 'file.txt'),
    input: { category: 'invalid' },
  }),
);

const createContext = () => ({ userId: 'user' });
createEdgeStoreNextHandler({
  router,
  createContext: ({ req }) => ({ userId: req.headers.get('user') ?? 'user' }),
});
createPagesHandler({ router, createContext });
createEdgeStoreExpressHandler({ router, createContext });
createEdgeStoreFastifyHandler({ router, createContext });
createEdgeStoreHonoHandler({ router, createContext });
createEdgeStoreRemixHandler({ router, createContext });
createEdgeStoreStartHandler({ router: s3Router, createContext });

expectError(createEdgeStoreNextHandler({ router }));
expectError(createPagesHandler({ router }));
expectError(createEdgeStoreExpressHandler({ router }));
expectError(createEdgeStoreFastifyHandler({ router }));
expectError(createEdgeStoreHonoHandler({ router }));
expectError(createEdgeStoreRemixHandler({ router }));
expectError(createEdgeStoreStartHandler({ router }));
expectError(
  createEdgeStoreNextHandler({ router, createContext: () => ({ userId: 1 }) }),
);
expectError(
  createEdgeStoreNextHandler({
    router,
    edgestore: { router, provider: edgestore() },
    createContext,
  }),
);
expectError(
  createEdgeStoreNextHandler({
    edgestore: { router, provider: edgestore() },
    createContext,
  }),
);

const publicEs = initEdgeStore.create();
const publicRouter = publicEs.router(
  { files: publicEs.fileBucket() },
  { baseUrl: 'http://localhost:3000/api/edgestore' },
);
createEdgeStoreNextHandler({ router: publicRouter });
createPagesHandler({ router: publicRouter });
createEdgeStoreExpressHandler({ router: publicRouter });
createEdgeStoreFastifyHandler({ router: publicRouter });
createEdgeStoreHonoHandler({ router: publicRouter });
createEdgeStoreRemixHandler({ router: publicRouter });
createEdgeStoreStartHandler({ router: publicRouter });
