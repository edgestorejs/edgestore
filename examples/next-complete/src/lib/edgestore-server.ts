import { createEdgeStore, initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { z } from 'zod';
import {
  categories,
  demoUsers,
  resolveDemoUser,
  type DemoContext,
} from './demo';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 512 * 1024 * 1024;

const uploadInput = z.object({
  category: z.enum(categories),
  label: z.string().trim().min(1).max(40),
  allowUpload: z.boolean(),
});

function createContext({ req }: CreateContextOptions): DemoContext {
  const user = resolveDemoUser(req.cookies.get('edgestore-demo-user')?.value);
  return demoUsers[user];
}

const es = initEdgeStore.context<DemoContext>().create();

const router = es.router({
  publicFiles: es
    .fileBucket({ maxSize: MAX_FILE_SIZE })
    .input(uploadInput)
    .path(({ ctx, input }) => [
      { owner: ctx.userId },
      { category: input.category },
    ])
    .metadata(({ ctx, input }) => ({
      label: input.label,
      uploadedByRole: ctx.role,
    }))
    .beforeUpload(({ ctx, input }) =>
      Boolean(ctx.role !== 'guest' && input.allowUpload),
    )
    .beforeDelete(({ ctx, fileInfo }) =>
      Boolean(ctx.role === 'admin' || fileInfo.path.owner === ctx.userId),
    ),
  publicImages: es
    .imageBucket({
      maxSize: MAX_IMAGE_SIZE,
      accept: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    })
    .input(uploadInput)
    .path(({ ctx, input }) => [
      { owner: ctx.userId },
      { category: input.category },
    ])
    .metadata(({ ctx, input }) => ({
      label: input.label,
      uploadedByRole: ctx.role,
    }))
    .beforeUpload(({ ctx, input }) =>
      Boolean(ctx.role !== 'guest' && input.allowUpload),
    )
    .beforeDelete(({ ctx, fileInfo }) =>
      Boolean(ctx.role === 'admin' || fileInfo.path.owner === ctx.userId),
    ),
  privateImages: es
    .imageBucket({
      maxSize: MAX_IMAGE_SIZE,
      accept: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    })
    .input(uploadInput)
    .path(({ ctx, input }) => [
      { owner: ctx.userId },
      { category: input.category },
    ])
    .metadata(({ ctx, input }) => ({
      label: input.label,
      uploadedByRole: ctx.role,
    }))
    .accessControl({
      OR: [{ userId: { path: 'owner' } }, { role: 'admin' }],
    })
    .autoSignedUrls({ expiresIn: 5 * 60, includeThumbnails: true })
    .beforeUpload(({ ctx, input }) =>
      Boolean(ctx.role !== 'guest' && input.allowUpload),
    )
    .beforeDelete(({ ctx, fileInfo }) =>
      Boolean(ctx.role === 'admin' || fileInfo.path.owner === ctx.userId),
    ),
});

export const configuredEdgeStore = createEdgeStore({
  router,
  provider: edgestore(),
  baseUrl:
    process.env.EDGE_STORE_EXAMPLE_BASE_URL ??
    'http://localhost:3000/api/edgestore',
});

export const handler = createEdgeStoreNextHandler({
  edgestore: configuredEdgeStore,
  createContext,
});

export const backendClient = configuredEdgeStore.client;

export type EdgeStoreRouter = typeof router;
