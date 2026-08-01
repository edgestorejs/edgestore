'use server';

import { createEdgeStoreSdk } from '@edgestore/sdk';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import {
  bucketNames,
  demoUsers,
  resolveDemoUser,
  type ActionResult,
  type BucketName,
  type Category,
  type DemoContext,
  type DemoUser,
  type FilePage,
  type SerializableError,
} from './demo';
import { backendClient } from './edgestore-server';

export type ListFilesInput = {
  bucket: BucketName;
  category?: Category;
  owner?: string;
  label?: string;
  uploadedAfter?: string;
  cursor?: string;
  limit?: number;
};

export type MutationInput = {
  bucket: BucketName;
  operation: 'confirm' | 'delete' | 'restore';
  ids: string[];
};

export type BackendUploadInput = {
  client: 'backend' | 'sdk';
  source: 'text' | 'blob' | 'url';
  content: string;
  category: Category;
  label: string;
  manualFileName?: string;
  replaceTargetUrl?: string;
  temporary: boolean;
  transform: boolean;
};

export async function setDemoUserAction(user: DemoUser) {
  if (!(user in demoUsers)) throw new Error('Unknown demo user.');
  (await cookies()).set('edgestore-demo-user', user, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export async function listFilesAction(
  input: ListFilesInput,
): Promise<ActionResult<FilePage>> {
  return capture(async () => {
    assertBucket(input.bucket);
    const ctx = await getDemoContext();
    if (input.bucket === 'privateImages' && ctx.role === 'guest') {
      throw new Error('Sign in to list protected images.');
    }
    const params = {
      filter: {
        path: {
          owner:
            input.bucket === 'privateImages' && ctx.role !== 'admin'
              ? ctx.userId
              : input.owner || undefined,
          category: input.category,
        },
        metadata: { label: input.label || undefined },
        uploadedAt: input.uploadedAfter
          ? { gt: new Date(input.uploadedAfter) }
          : undefined,
      },
      cursor: input.cursor,
      limit: input.limit ?? 12,
    };

    switch (input.bucket) {
      case 'publicFiles':
        return toFilePage(await backendClient.publicFiles.list(params));
      case 'publicImages':
        return toFilePage(await backendClient.publicImages.list(params));
      case 'privateImages':
        return toFilePage(await backendClient.privateImages.list(params));
    }
  });
}

export async function lookupFileAction(input: {
  bucket: BucketName;
  id: string;
}): Promise<ActionResult<unknown>> {
  return capture(async () => {
    assertBucket(input.bucket);
    const ctx = await getDemoContext();
    const file = await backendClient[input.bucket].get({ id: input.id });
    authorizeFile(ctx, file.path.owner);
    return file;
  });
}

export async function mutateFilesAction(
  input: MutationInput,
): Promise<ActionResult<unknown>> {
  return capture(async () => {
    assertBucket(input.bucket);
    if (input.ids.length === 0) throw new Error('Select at least one file.');

    const ctx = await getDemoContext();
    await Promise.all(
      input.ids.map(async (id) => {
        const file = await backendClient[input.bucket].get({ id });
        authorizeFile(ctx, file.path.owner);
      }),
    );
    const refs = input.ids.map((id) => ({ id }));
    const client = backendClient[input.bucket];
    const result =
      input.ids.length === 1
        ? await client[input.operation]({ id: input.ids[0]! })
        : await client[`${input.operation}Many`]({ refs });

    revalidatePath('/');
    return result;
  });
}

export async function createSignedUrlAction(input: {
  id: string;
  expiresIn: number;
}): Promise<ActionResult<unknown>> {
  return capture(async () => {
    const ctx = await getDemoContext();
    const file = await backendClient.privateImages.get({ id: input.id });
    authorizeFile(ctx, file.path.owner);
    return await backendClient.privateImages.createSignedUrl({
      url: { id: input.id },
      expiresIn: input.expiresIn,
    });
  });
}

export async function backendUploadAction(
  input: BackendUploadInput,
): Promise<ActionResult<unknown>> {
  return capture(async () => {
    const ctx = await getDemoContext();
    if (ctx.role === 'guest') {
      throw new Error(
        'Backend clients are privileged, so this action performs its own authorization check.',
      );
    }

    const progress: unknown[] = [];

    if (input.client === 'sdk') {
      const sdk = createSdk();
      const common = {
        bucket: 'publicFiles',
        fileName: input.manualFileName || undefined,
        temporary: input.temporary,
        path: [
          { key: 'owner', value: ctx.userId },
          { key: 'category', value: input.category },
        ],
        metadata: {
          label: input.label,
          uploadedByRole: ctx.role,
        },
        replaceTarget: input.replaceTargetUrl
          ? { url: input.replaceTargetUrl }
          : undefined,
        onProgress: (event: unknown) => progress.push(event),
      };
      const uploaded =
        input.source === 'url'
          ? await sdk.runtime.uploads.uploadFromUrl({
              ...common,
              url: validateRemoteUrl(input.content),
            })
          : await sdk.runtime.uploads.upload({
              ...common,
              source:
                input.source === 'blob'
                  ? new Blob([input.content], { type: 'text/plain' })
                  : input.content,
            });
      revalidatePath('/');
      return { uploaded, progress };
    }

    const content =
      input.source === 'url'
        ? { url: validateRemoteUrl(input.content), extension: 'txt' }
        : input.source === 'blob'
          ? {
              blob: new Blob([input.content], { type: 'text/plain' }),
              extension: 'txt',
            }
          : input.content;

    const uploaded = await backendClient.publicFiles.upload({
      content,
      ctx,
      input: {
        category: input.category,
        label: input.label,
        allowUpload: true,
      },
      options: {
        manualFileName: input.manualFileName || undefined,
        replaceTargetUrl: input.replaceTargetUrl || undefined,
        temporary: input.temporary,
        transform: input.transform
          ? async ({ blob, extension }) => ({
              blob: new Blob([(await blob.text()).toUpperCase()], {
                type: blob.type,
              }),
              extension,
            })
          : undefined,
      },
      onProgress: (event) => progress.push(event),
    });

    revalidatePath('/');
    return { uploaded, progress };
  });
}

export async function inspectSdkAction(): Promise<ActionResult<unknown>> {
  return capture(async () => {
    const ctx = await getDemoContext();
    if (ctx.role !== 'admin') {
      throw new Error(
        'Switch to Admin to inspect project-level SDK resources.',
      );
    }
    const sdk = createSdk();
    const [health, project, buckets] = await Promise.all([
      sdk.system.health(),
      sdk.runtime.projects.get(),
      sdk.runtime.buckets.list(),
    ]);
    return { health, project, buckets };
  });
}

async function getDemoContext(): Promise<DemoContext> {
  const user = resolveDemoUser(
    (await cookies()).get('edgestore-demo-user')?.value,
  );
  return demoUsers[user];
}

function createSdk() {
  const accessKey = process.env.EDGE_STORE_ACCESS_KEY;
  const secretKey = process.env.EDGE_STORE_SECRET_KEY;
  if (!accessKey || !secretKey) {
    throw new Error('Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY.');
  }
  const endpoint = process.env.EDGE_STORE_API_ENDPOINT?.replace(/\/+$/, '');
  return createEdgeStoreSdk({
    credentials: { accessKey, secretKey },
    apiUrl: endpoint
      ? endpoint.endsWith('/v2')
        ? endpoint
        : `${endpoint}/v2`
      : undefined,
  });
}

function assertBucket(bucket: string): asserts bucket is BucketName {
  if (!bucketNames.includes(bucket as BucketName)) {
    throw new Error('Unknown bucket.');
  }
}

function authorizeFile(ctx: DemoContext, owner: string | undefined) {
  if (ctx.role === 'guest' || (ctx.role !== 'admin' && owner !== ctx.userId)) {
    throw new Error('The active demo identity cannot access this file.');
  }
}

function validateRemoteUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Remote upload URLs must use HTTP or HTTPS.');
  }
  return url.toString();
}

function toFilePage(
  result: Awaited<ReturnType<typeof backendClient.publicFiles.list>>,
): FilePage {
  return result;
}

async function capture<T>(
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: serializeError(error) };
  }
}

function serializeError(error: unknown): SerializableError {
  if (!(error instanceof Error)) {
    return { name: 'UnknownError', message: String(error) };
  }
  const value = error as Error & {
    code?: unknown;
    status?: unknown;
    requestId?: unknown;
    details?: unknown;
    data?: unknown;
  };
  return {
    name: error.name,
    message: error.message,
    details: {
      code: value.code,
      status: value.status,
      requestId: value.requestId,
      details: value.details,
      data: value.data,
    },
  };
}
