import {
  createEdgeStore,
  initEdgeStore,
  type InferClientInputs,
  type InferClientOutputs,
} from '@edgestore/server';
import {
  type EdgeStoreFileReference,
  type InferClientResponse,
} from '@edgestore/server/core';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { s3 } from '@edgestore/server/providers/s3';
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
  broadMetadata: es.fileBucket().metadata(
    (): Record<string, string | null | undefined> => ({
      present: 'value',
      absent: undefined,
    }),
  ),
});

const client = createEdgeStore({
  router,
  provider: edgestore(),
}).client;

const publicEs = initEdgeStore.create();
const publicRouter = publicEs.router({ files: publicEs.fileBucket() });
const publicClient = createEdgeStore({
  router: publicRouter,
  provider: edgestore(),
}).client;
const protectedClient = createEdgeStore({
  provider: edgestore(),
  router: publicEs.router({
    privateFiles: publicEs.fileBucket().accessControl('private'),
    privateImages: publicEs
      .imageBucket()
      .accessControl('private')
      .autoSignedUrls({ expiresIn: 300 }),
  }),
}).client;
const s3EdgeStore = createEdgeStore({
  router: publicRouter,
  provider: s3(),
});
expectError(s3EdgeStore.client);

const {
  restoreFiles: _restoreFiles,
  getFile: _hostedGetFile,
  ...providerWithoutRestore
} = edgestore();
const syntheticProvider = {
  ...providerWithoutRestore,
  upload: async () => ({
    file: {
      url: 'https://s3.example/files/uploaded.txt',
      path: {},
      metadata: {},
      uploadedAt: new Date(),
      updatedAt: new Date(),
      eTag: 'upload-etag',
    },
  }),
  getFile: async ({
    file,
  }: {
    bucketName: string;
    file: { objectKey: string };
  }) => ({
    url: `https://s3.example/${file.objectKey}`,
    path: {},
    metadata: {},
    uploadedAt: new Date(),
    updatedAt: new Date(),
    eTag: 'etag',
  }),
  listFiles: async ({
    cursor,
    limit = 20,
  }: {
    bucketName: string;
    filter?: unknown;
    cursor?: number;
    limit?: number;
  }) => ({
    items: [
      {
        url: 'https://s3.example/files/file.txt',
        path: {},
        metadata: {},
        uploadedAt: new Date(),
        updatedAt: new Date(),
        eTag: 'etag',
      },
    ],
    limit,
    nextCursor: cursor === undefined ? 2 : null,
    hasMore: cursor === undefined,
  }),
  deleteFiles: async ({
    files,
  }: {
    bucketName: string;
    files: { objectKey: string }[];
  }) => ({
    results: files.map((fileRef) => ({
      fileRef,
      success: false as const,
      error: {
        code: 'OBJECT_LOCKED' as const,
        message: 'The object is locked.',
      },
    })),
    successCount: 0,
    failureCount: files.length,
  }),
  getSignedUrls: async ({
    urls,
  }: {
    bucketName: string;
    urls: { objectKey: string }[];
    expiresIn?: number;
    includeThumbnails?: boolean;
  }) =>
    urls.map(({ objectKey }) => ({
      url: `https://s3.example/${objectKey}`,
      signedUrl: `https://signed.s3.example/${objectKey}`,
      expiresAt: new Date(),
      expiresIn: 60,
      providerRegion: 'us-east-1' as const,
    })),
};
const syntheticClient = createEdgeStore({
  router: publicRouter,
  provider: syntheticProvider,
}).client;
const syntheticProtectedRouter = publicEs.router({
  files: publicEs.fileBucket().accessControl('private'),
});
const syntheticProtectedClient = createEdgeStore({
  router: syntheticProtectedRouter,
  provider: syntheticProvider,
}).client;

expectError(syntheticClient.files.restoreFile);
expectError(syntheticClient.files.getFile({ id: 'file-id' }));
void syntheticClient.files
  .getFile({ objectKey: 'files/file.txt' })
  .then((file) => {
    expectType<string>(file.eTag);
    expectError(file.accountId);
  });
expectError(syntheticClient.files.listFiles({ cursor: 'next' }));
void syntheticClient.files.listFiles({ cursor: 1 }).then((page) => {
  expectType<number | null>(page.nextCursor);
  expectType<string>(page.items[0]!.eTag);
  expectError(page.items[0]!.accountId);
});
void syntheticClient.files.upload({ content: 'hello' }).then((file) => {
  expectType<string>(file.eTag);
  expectError(file.accountId);
});
expectError(syntheticClient.files.deleteFile({ id: 'file-id' }));
void syntheticClient.files
  .deleteFiles({ refs: [{ objectKey: 'files/file.txt' }] })
  .then(({ failed }) => {
    expectType<'OBJECT_LOCKED'>(failed[0]!.error.code);
    expectType<string>(failed[0]!.ref.objectKey);
  });
expectError(
  syntheticProtectedClient.files.getSignedUrl({
    url: 'https://s3.example/files/file.txt',
  }),
);
void syntheticProtectedClient.files
  .getSignedUrl({
    url: { objectKey: 'files/file.txt' },
  })
  .then((signedUrl) => {
    expectType<'us-east-1'>(signedUrl.providerRegion);
    expectType<Date>(signedUrl.expiresAt);
  });

expectError(
  createEdgeStore({
    router: publicRouter,
    provider: {
      ...syntheticProvider,
      getFile: async ({
        file,
      }: {
        bucketName: string;
        file: { objectKey: string };
      }) => file.objectKey,
    },
  }),
);

expectError(
  createEdgeStore({
    router: publicRouter,
    provider: {
      ...syntheticProvider,
      listFiles: async ({
        cursor,
      }: {
        bucketName: string;
        cursor?: number;
      }) => ({
        items: [],
        limit: 20,
        nextCursor: cursor === undefined ? 'next' : null,
        hasMore: cursor === undefined,
      }),
    },
  }),
);

expectError(
  createEdgeStore({
    router: publicRouter,
    provider: {
      ...syntheticProvider,
      deleteFiles: async ({
        files,
      }: {
        bucketName: string;
        files: { objectKey: string }[];
      }) => ({
        results: files.map(() => ({
          fileRef: { id: 'different-reference' },
          success: true as const,
        })),
        successCount: files.length,
        failureCount: 0,
      }),
    },
  }),
);

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
  protectedClient.privateFiles.getSignedUrl({
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
  protectedClient.privateImages.getSignedUrls({
    urls: ['https://files.edgestore.dev/project/privateImages/image.png'],
    includeThumbnails: true,
  }),
);

void protectedClient.privateImages.upload({ content: 'hello' }).then((file) => {
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
void client.broadMetadata
  .upload({
    content: 'hello',
    ctx: { userId: 'user-1', role: 'admin' },
  })
  .then((file) => {
    expectType<Record<string, string>>(file.metadata);
  });
void client.broadMetadata.getFile({ id: 'file-id' }).then((file) => {
  expectType<Record<string, string>>(file.metadata);
});
void client.broadMetadata.listFiles().then((page) => {
  expectType<Record<string, string>>(page.items[0]!.metadata);
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

type ClientInputs = InferClientInputs<typeof router>;
type ClientOutputs = InferClientOutputs<typeof router>;
type DeprecatedClientResponses = InferClientResponse<typeof router>;

expectType<Context>({} as ClientInputs['avatars']['upload']['ctx']);
expectType<{ type: 'profile' | 'post' }>(
  {} as ClientInputs['avatars']['upload']['input'],
);
expectNotAssignable<ClientInputs['avatars']['upload']>({
  content: 'hello',
  ctx: { userId: 'user-1', role: 'admin' },
});
expectType<string>({} as ClientOutputs['avatars']['upload']['id']);
expectType<number>({} as ClientOutputs['documents']['getFile']['sizeBytes']);
expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
  {} as ClientOutputs['avatars']['listFiles']['items'][number]['metadata'],
);
expectType<{ author: string; type: string }>(
  {} as ClientOutputs['avatars']['upload']['path'],
);
expectType<EdgeStoreFileReference>(
  {} as ClientOutputs['documents']['deleteFile']['ref'],
);
expectAssignable<ClientOutputs>({} as DeprecatedClientResponses);
expectAssignable<DeprecatedClientResponses>({} as ClientOutputs);

type SyntheticInputs = InferClientInputs<
  typeof publicRouter,
  typeof syntheticProvider
>;
type SyntheticOutputs = InferClientOutputs<
  typeof publicRouter,
  typeof syntheticProvider
>;
type SyntheticProtectedInputs = InferClientInputs<
  typeof syntheticProtectedRouter,
  typeof syntheticProvider
>;
type SyntheticProtectedOutputs = InferClientOutputs<
  typeof syntheticProtectedRouter,
  typeof syntheticProvider
>;

expectType<{ objectKey: string }>({} as SyntheticInputs['files']['getFile']);
expectType<number | undefined>(
  {} as NonNullable<SyntheticInputs['files']['listFiles']>['cursor'],
);
expectType<{ objectKey: string }[]>(
  {} as SyntheticInputs['files']['deleteFiles']['refs'],
);
expectType<{ objectKey: string }>(
  {} as SyntheticProtectedInputs['files']['getSignedUrl']['url'],
);
expectError(({} as SyntheticInputs['files']).restoreFile);

expectType<string>({} as SyntheticOutputs['files']['upload']['eTag']);
expectType<number | null>(
  {} as SyntheticOutputs['files']['listFiles']['nextCursor'],
);
expectType<'OBJECT_LOCKED'>(
  {} as SyntheticOutputs['files']['deleteFiles']['failed'][number]['error']['code'],
);
expectType<'us-east-1'>(
  {} as SyntheticProtectedOutputs['files']['getSignedUrl']['providerRegion'],
);
expectError(({} as SyntheticOutputs['files']).restoreFile);
