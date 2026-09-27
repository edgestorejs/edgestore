import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreNextHandler,
  type CreateContextOptions,
} from '@edgestore/server/adapters/next/app';
import { z } from 'zod';
import { getUser, USER_COOKIE, type Context } from './users';

const MiB = 1024 * 1024;

function createContext({ req }: CreateContextOptions): Context {
  const { userId, role } = getUser(req.cookies.get(USER_COOKIE)?.value);
  return { userId, role };
}

const es = initEdgeStore.context<Context>().create();

// Shared rules: only signed-in users can upload, and only the owner can
// delete or replace a file from the browser.
const canUpload =
  (bucket: 'publicFiles' | 'publicImages' | 'privateImages') =>
  async ({
    ctx,
    fileInfo,
  }: {
    ctx: Context;
    fileInfo: { replaceTargetUrl?: string };
  }): Promise<boolean> => {
    if (ctx.role !== 'user') return false;
    if (!fileInfo.replaceTargetUrl) return true;
    // Replacing deletes the old file without running `beforeDelete`, so check
    // that the user owns it.
    const target = await router.client[bucket].get({
      url: fileInfo.replaceTargetUrl,
    });
    return target.path.owner === ctx.userId;
  };
const isOwner = ({
  ctx,
  fileInfo,
}: {
  ctx: Context;
  fileInfo: { path: Record<string, string> };
}) => fileInfo.path.owner === ctx.userId;

export const router = es.router({
  /** Any file type, typed input, metadata, and multipart uploads. */
  publicFiles: es
    .fileBucket({ maxSize: 200 * MiB })
    .input(z.object({ label: z.string().max(40) }))
    .path(({ ctx }) => [{ owner: ctx.userId }])
    .metadata(({ input }) => ({ label: input.label }))
    .beforeUpload(canUpload('publicFiles'))
    .beforeDelete(isOwner),

  /** Images up to 2 MiB. EdgeStore generates thumbnails automatically. */
  publicImages: es
    .imageBucket({ maxSize: 2 * MiB })
    .path(({ ctx }) => [{ owner: ctx.userId }])
    .beforeUpload(canUpload('publicImages'))
    .beforeDelete(isOwner),

  /** Protected images: only the owner's browser can load them. */
  privateImages: es
    .imageBucket({ maxSize: 2 * MiB })
    .path(({ ctx }) => [{ owner: ctx.userId }])
    .accessControl({ userId: { path: 'owner' } })
    .beforeUpload(canUpload('privateImages'))
    .beforeDelete(isOwner),
});

export const handler = createEdgeStoreNextHandler({ router, createContext });

export type EdgeStoreRouter = typeof router;
export type BucketName = keyof EdgeStoreRouter['buckets'];
