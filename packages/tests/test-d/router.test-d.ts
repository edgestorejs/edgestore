import { createEdgeStoreProvider } from '@edgestore/react';
import {
  defineProvider,
  initEdgeStore,
  type EdgeStoreClient,
  type InferClientInputs,
  type InferClientOutputs,
} from '@edgestore/server';
import { createEdgeStoreExpressHandler } from '@edgestore/server/adapters/express';
import { createEdgeStoreFastifyHandler } from '@edgestore/server/adapters/fastify';
import { createEdgeStoreHonoHandler } from '@edgestore/server/adapters/hono';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';
import { createEdgeStoreNextHandler as createPagesHandler } from '@edgestore/server/adapters/next/pages';
import { createEdgeStoreRemixHandler } from '@edgestore/server/adapters/remix';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { s3 } from '@edgestore/server/providers/s3';
import { expectError, expectType } from 'tsd';
import { z } from 'zod';

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

// Capability inference should follow the provider, independently of S3 features.
const lookupProvider = defineProvider({
  name: 'lookup-only',
  baseUrl: 'https://files.example.com',
  reference: {
    schema: z.object({ key: z.string() }),
    fromUrl: (url) => ({ key: url }),
  },
  async init() {
    return {};
  },
  uploads: {
    async request() {
      return { uploadUrl: '', accessUrl: '' };
    },
  },
  files: {
    async get() {
      return {
        url: '',
        sizeBytes: 0,
        uploadedAt: new Date(),
        updatedAt: new Date(),
      };
    },
  },
});
const lookupRouter = publicRouter.provider(lookupProvider);
type LookupClient = EdgeStoreClient<typeof lookupRouter>;
type LookupInputs = InferClientInputs<typeof lookupRouter>;
type LookupOutputs = InferClientOutputs<typeof lookupRouter>;
expectType<LookupClient>(lookupRouter.client);
expectType<'get'>({} as keyof LookupClient['files']);
expectType<'get'>({} as keyof LookupInputs['files']);
expectType<'get'>({} as keyof LookupOutputs['files']);
expectType<{ key: string }>({} as LookupInputs['files']['get']);
expectType<number>({} as LookupOutputs['files']['get']['sizeBytes']);
expectType<EdgeStoreClient<typeof router>>(router.client);
expectType<string>(
  {} as InferClientOutputs<typeof router>['files']['upload']['id'],
);
