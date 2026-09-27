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
// delete from the browser.
const isSignedIn = ({ ctx }: { ctx: Context }) => ctx.role === 'user';
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
    .beforeUpload(isSignedIn)
    .beforeDelete(isOwner),

  /** Images up to 2 MiB. EdgeStore generates thumbnails automatically. */
  publicImages: es
    .imageBucket({ maxSize: 2 * MiB })
    .path(({ ctx }) => [{ owner: ctx.userId }])
    .beforeUpload(isSignedIn)
    .beforeDelete(isOwner),

  /** Protected images: only the owner's browser can load them. */
  privateImages: es
    .imageBucket({ maxSize: 2 * MiB })
    .path(({ ctx }) => [{ owner: ctx.userId }])
    .accessControl({ userId: { path: 'owner' } })
    .beforeUpload(isSignedIn)
    .beforeDelete(isOwner),
});

export const handler = createEdgeStoreNextHandler({ router, createContext });

export type EdgeStoreRouter = typeof router;
export type BucketName = keyof EdgeStoreRouter['buckets'];
