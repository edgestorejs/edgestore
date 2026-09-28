'use server';

import { createEdgeStoreSdk } from '@edgestore/sdk';
import { cookies } from 'next/headers';
import { router, type BucketName } from './edgestore-server';
import { getUser, USER_COOKIE, users, type UserId } from './users';

/**
 * Server actions return errors as values because Next.js hides thrown error
 * messages in production builds.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(action: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await action() };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function currentUser() {
  return getUser((await cookies()).get(USER_COOKIE)?.value);
}

/**
 * `router.client` is the privileged backend client. It skips `beforeUpload`,
 * `beforeDelete`, and `accessControl`, so every action checks the user itself.
 */
async function requireSignedIn() {
  const user = await currentUser();
  if (user.role !== 'user') throw new Error('Sign in first.');
  return user;
}

async function requireOwner(bucket: BucketName, id: string) {
  const user = await requireSignedIn();
  const file = await router.client[bucket].get({ id });
  if (file.path.owner !== user.userId) {
    throw new Error(`Only ${file.path.owner} can change this file.`);
  }
}

export async function switchUser(id: UserId) {
  if (!(id in users)) throw new Error('Unknown user.');
  (await cookies()).set(USER_COOKIE, id, { httpOnly: true, sameSite: 'lax' });
}

export async function listFiles(input: {
  bucket: BucketName;
  onlyMine: boolean;
  cursor?: string;
}) {
  return run(async () => {
    const user = await currentUser();
    return router.client[input.bucket].list({
      filter: { path: { owner: input.onlyMine ? user.userId : undefined } },
      cursor: input.cursor,
      limit: 8,
    });
  });
}

export async function softDeleteFile(input: {
  bucket: BucketName;
  id: string;
}) {
  return run(async () => {
    await requireOwner(input.bucket, input.id);
    return router.client[input.bucket].delete({ id: input.id });
  });
}

export async function restoreFile(input: { bucket: BucketName; id: string }) {
  return run(async () => {
    await requireOwner(input.bucket, input.id);
    return router.client[input.bucket].restore({ id: input.id });
  });
}

export async function createSignedUrl(id: string) {
  return run(async () => {
    await requireOwner('privateImages', id);
    return router.client.privateImages.createSignedUrl({
      url: { id },
      expiresIn: 60,
    });
  });
}

export async function uploadFromServer(source: 'text' | 'url') {
  return run(async () => {
    const user = await requireSignedIn();
    return router.client.publicFiles.upload({
      content:
        source === 'text'
          ? `Uploaded by ${user.name} from a server action at ${new Date().toISOString()}`
          : { url: 'https://edgestore.dev/favicon.ico', extension: 'ico' },
      // Backend uploads take the context directly instead of reading a cookie.
      ctx: { userId: user.userId, role: user.role },
      input: { label: `server ${source}` },
    });
  });
}

export async function uploadWithSdk() {
  return run(async () => {
    const user = await requireSignedIn();
    // The low-level SDK talks to the EdgeStore API directly, without router
    // rules, so the path and metadata are passed explicitly.
    const sdk = createEdgeStoreSdk({
      credentials: {
        accessKey: (process.env.EDGESTORE_ACCESS_KEY ??
          process.env.EDGE_STORE_ACCESS_KEY)!,
        secretKey: (process.env.EDGESTORE_SECRET_KEY ??
          process.env.EDGE_STORE_SECRET_KEY)!,
      },
    });
    const { file } = await sdk.runtime.uploads.upload({
      bucket: 'publicFiles',
      source: `Uploaded by ${user.name} with @edgestore/sdk`,
      fileName: 'sdk-upload.txt',
      path: [{ key: 'owner', value: user.userId }],
      metadata: { label: 'sdk' },
    });
    return file;
  });
}
