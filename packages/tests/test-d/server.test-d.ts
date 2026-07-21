import { initEdgeStore } from '@edgestore/server';
import {
  createEdgeStoreClient,
  type EdgeStoreFileReference,
  type InferClientResponse,
} from '@edgestore/server/core';
import {
  expectAssignable,
  expectError,
  expectNotAssignable,
  expectType,
} from 'tsd';
import { z } from 'zod';

type Context = {
  userId: string;
  role: 'admin' | 'visitor';
};

const es = initEdgeStore.context<Context>().create();

const router = es.router({
  avatars: es
    .imageBucket()
    .input(z.object({ type: z.enum(['profile', 'post']) }))
    .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
    .metadata(({ ctx, input }) => ({
      role: ctx.role,
      type: input.type,
    })),
  documents: es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]),
});

const client = createEdgeStoreClient({ router });

const publicEs = initEdgeStore.create();
const publicClient = createEdgeStoreClient({
  router: publicEs.router({ files: publicEs.fileBucket() }),
});
const privateClient = createEdgeStoreClient({
  router: publicEs.router({
    privateFiles: publicEs.fileBucket().accessControl('private'),
    privateImages: publicEs
      .imageBucket()
      .accessControl('private')
      .autoSignedUrls({ expiresIn: 300 }),
  }),
});

void client.avatars.upload({
  content: 'hello',
  ctx: { userId: 'user-1', role: 'admin' },
  input: { type: 'profile' },
});

expectNotAssignable<Parameters<typeof client.avatars.upload>[0]>({
  content: 'hello',
  ctx: { userId: 'user-1', role: 'admin' },
});
expectNotAssignable<Parameters<typeof client.avatars.upload>[0]>({
  content: 'hello',
  input: { type: 'profile' },
});
expectNotAssignable<Parameters<typeof client.documents.upload>[0]>({
  content: 'hello',
});

void client.documents.upload({
  content: 'hello',
  ctx: { userId: 'user-1', role: 'visitor' },
});
void publicClient.files.upload({ content: 'hello' });

expectError(publicClient.files.getSignedUrl({ url: 'https://example.com/a' }));
expectType<
  Promise<{
    url: string;
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
  }>
>(
  privateClient.privateFiles.getSignedUrl({
    url: 'https://files.edgestore.dev/project/privateFiles/file.txt',
  }),
);
expectAssignable<
  Promise<
    {
      url: string;
      signedUrl: string;
      expiresAt: Date;
      expiresIn: number;
      thumbnailUrl?: string | null;
      signedThumbnailUrl?: string | null;
    }[]
  >
>(
  privateClient.privateImages.getSignedUrls({
    urls: ['https://files.edgestore.dev/project/privateImages/image.png'],
    includeThumbnails: true,
  }),
);

void privateClient.privateImages.upload({ content: 'hello' }).then((file) => {
  expectType<string>(file.id);
  expectType<string>(file.key);
  expectType<number>(file.sizeBytes);
  expectType<Date>(file.uploadedAt);
  expectType<Record<string, never>>(file.metadata);
  expectType<Record<string, never>>(file.path);
  expectType<[]>(file.pathOrder);
  expectType<string>(file.signedUrl);
});

void client.avatars
  .upload({
    content: 'hello',
    ctx: { userId: 'user-1', role: 'admin' },
    input: { type: 'post' },
  })
  .then((file) => {
    expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
      file.metadata,
    );
    expectType<{ author: string; type: string }>(file.path);
    expectType<('author' | 'type')[]>(file.pathOrder);
  });

void client.avatars.getFile({ id: 'file-id' }).then((file) => {
  expectType<string>(file.id);
  expectType<number>(file.sizeBytes);
  expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
    file.metadata,
  );
  expectType<{ author: string; type: string }>(file.path);
});
void client.documents.getFile({ key: 'files/document.pdf' });
void client.documents.getFile({ url: 'https://files.example/document.pdf' });

void client.avatars.listFiles({ cursor: 'next', limit: 20 }).then((page) => {
  expectType<number>(page.limit);
  expectType<string | null>(page.nextCursor);
  expectType<boolean>(page.hasMore);
  expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
    page.items[0]!.metadata,
  );
});
expectError(client.avatars.listFiles({ pagination: { limit: 20 } }));
expectNotAssignable<
  NonNullable<Parameters<typeof client.documents.listFiles>[0]>
>({ filter: { path: { unknown: { eq: 'value' } } } });

expectAssignable<
  AsyncIterable<{
    id: string;
    metadata: { role: 'admin' | 'visitor'; type: 'profile' | 'post' };
    path: { author: string; type: string };
  }>
>(client.avatars.listAllFiles({ limit: 50 }));

expectType<Promise<{ ref: EdgeStoreFileReference }>>(
  client.documents.confirmUpload({ id: 'file-id' }),
);
expectType<Promise<{ ref: EdgeStoreFileReference }>>(
  client.documents.deleteFile({ key: 'files/document.pdf' }),
);
expectType<Promise<{ ref: EdgeStoreFileReference }>>(
  client.documents.restoreFile({ url: 'https://files.example/document.pdf' }),
);
void client.documents
  .deleteFiles({ refs: [{ id: 'one' }, { key: 'files/two' }] })
  .then((result) => {
    expectType<EdgeStoreFileReference[]>(result.succeeded);
    expectType<EdgeStoreFileReference>(result.failed[0]!.ref);
    expectType<
      | 'FILE_NOT_CONFIRMABLE'
      | 'FILE_NOT_DELETABLE'
      | 'FILE_NOT_RESTORABLE'
      | 'INVALID_FILE_REF'
    >(result.failed[0]!.error.code);
  });

type ClientResponses = InferClientResponse<typeof router>;
expectType<string>({} as ClientResponses['avatars']['upload']['id']);
expectType<number>({} as ClientResponses['documents']['getFile']['sizeBytes']);
expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
  {} as ClientResponses['avatars']['listFiles']['items'][number]['metadata'],
);
expectType<EdgeStoreFileReference>(
  {} as ClientResponses['documents']['deleteFile']['ref'],
);
