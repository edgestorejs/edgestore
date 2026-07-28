import {
  createEdgeStore,
  defineProvider,
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
import { type InitParams } from '@edgestore/shared';
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
void s3EdgeStore.client.files.get({ url: 'https://s3.example/file' });
expectError(s3EdgeStore.client.files.upload);
expectError(s3EdgeStore.client.files.list);
expectError(s3EdgeStore.client.files.confirm);

const syntheticProvider = defineProvider({
  name: 'synthetic',
  baseUrl: 'https://s3.example',
  init: async () => ({}),
  reference: {
    schema: z.object({ objectKey: z.string() }),
    fromUrl: (url) => ({ objectKey: new URL(url).pathname.slice(1) }),
  },
  uploads: {
    request: async () => {
      throw new Error('Not implemented');
    },
    upload: async () => ({
      file: {
        url: 'https://s3.example/files/uploaded.txt',
        sizeBytes: 5,
        path: {},
        metadata: {},
        uploadedAt: new Date(),
        updatedAt: new Date(),
        eTag: 'upload-etag',
      },
    }),
  },
  files: {
    cursorSchema: z.number(),
    get: async ({ file }) => ({
      url: `https://s3.example/${file.objectKey}`,
      sizeBytes: 5,
      path: { storageRegion: 'us-east-1' as const },
      metadata: { storageClass: 'archive' as const },
      uploadedAt: new Date(),
      updatedAt: new Date(),
      eTag: 'etag',
    }),
    list: async ({ cursor, limit = 20 }) => ({
      items: [
        {
          url: 'https://s3.example/files/file.txt',
          sizeBytes: 5,
          path: { storageRegion: 'us-east-1' as const },
          metadata: { storageClass: 'archive' as const },
          uploadedAt: new Date(),
          updatedAt: new Date(),
          eTag: 'etag',
        },
      ],
      limit,
      nextCursor: cursor === undefined ? 2 : null,
      hasMore: cursor === undefined,
    }),
    delete: async ({ files }) => ({
      results: files.map(() => ({
        success: false as const,
        error: {
          code: 'OBJECT_LOCKED' as const,
          message: 'The object is locked.',
        },
      })),
    }),
    getSignedUrls: async ({ files }) =>
      files.map(({ objectKey }) => ({
        url: `https://s3.example/${objectKey}`,
        signedUrl: `https://signed.s3.example/${objectKey}`,
        expiresAt: new Date(),
        expiresIn: 60,
        providerRegion: 'us-east-1' as const,
      })),
  },
});

defineProvider({
  ...syntheticProvider,
  async init({ ctx, router }) {
    expectType<string | undefined>(ctx.userId);
    expectType<typeof ctx>(router.$config.ctx);
    return {};
  },
});

type ProviderInitContext = InitParams['ctx'];
expectNotAssignable<ProviderInitContext>({
  organization: { id: 'org-1' },
});
expectNotAssignable<ProviderInitContext>({ retryCount: 3 });

expectError(
  defineProvider({
    ...syntheticProvider,
    uploads: {
      request: async () => ({
        accessUrl: 'https://s3.example/files/uploaded.txt',
        multipart: {
          key: 'files/uploaded.txt',
          uploadId: 'upload-id',
          partSize: 5,
          totalParts: 1,
          parts: [
            {
              partNumber: 1,
              uploadUrl: 'https://upload.s3.example/part-1',
            },
          ],
        },
      }),
    },
  }),
);

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

expectError(syntheticClient.files.restore);
expectError(syntheticClient.files.get({ id: 'file-id' }));
void syntheticClient.files.get({ objectKey: 'files/file.txt' }).then((file) => {
  expectType<string>(file.eTag);
  expectType<'us-east-1'>(file.path.storageRegion);
  expectType<'archive'>(file.metadata.storageClass);
  expectError(file.accountId);
});
expectError(syntheticClient.files.list({ cursor: 'next' }));
void syntheticClient.files.list({ cursor: 1 }).then((page) => {
  expectType<number | null>(page.nextCursor);
  expectType<string>(page.items[0]!.eTag);
  expectType<'us-east-1'>(page.items[0]!.path.storageRegion);
  expectType<'archive'>(page.items[0]!.metadata.storageClass);
  expectError(page.items[0]!.accountId);
});
void syntheticClient.files.upload({ content: 'hello' }).then((file) => {
  expectType<string>(file.eTag);
  expectError(file.accountId);
});
expectError(syntheticClient.files.delete({ id: 'file-id' }));
void syntheticClient.files
  .deleteMany({ refs: [{ objectKey: 'files/file.txt' }] })
  .then(({ failed }) => {
    expectType<'OBJECT_LOCKED'>(failed[0]!.error.code);
    expectType<string>(failed[0]!.ref.objectKey);
  });
expectError(
  syntheticProtectedClient.files.createSignedUrl({
    url: 'https://s3.example/files/file.txt',
  }),
);
void syntheticProtectedClient.files
  .createSignedUrl({
    url: { objectKey: 'files/file.txt' },
  })
  .then((signedUrl) => {
    expectType<'us-east-1'>(signedUrl.providerRegion);
    expectType<Date>(signedUrl.expiresAt);
  });

expectError(
  defineProvider({
    ...syntheticProvider,
    files: {
      ...syntheticProvider.files,
      list: async ({ cursor }) => ({
        items: [],
        limit: 20,
        nextCursor: cursor === undefined ? 'next' : null,
        hasMore: cursor === undefined,
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

expectError(
  publicClient.files.createSignedUrl({ url: 'https://example.com/a' }),
);
expectType<
  Promise<{
    url: string;
    signedUrl: string;
    expiresAt: Date;
    expiresIn: number;
  }>
>(
  protectedClient.privateFiles.createSignedUrl({
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
  protectedClient.privateImages.createSignedUrls({
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

void client.avatars.get({ id: 'file-id' }).then((file) => {
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
void client.broadMetadata.get({ id: 'file-id' }).then((file) => {
  expectType<Record<string, string>>(file.metadata);
});
void client.broadMetadata.list().then((page) => {
  expectType<Record<string, string>>(page.items[0]!.metadata);
});
void client.documents.get({ key: 'files/document.pdf' });
void client.documents.get({ url: 'https://files.example/document.pdf' });

void client.avatars.list({ cursor: 'next', limit: 20 }).then((page) => {
  expectType<number>(page.limit);
  expectType<string | null>(page.nextCursor);
  expectType<boolean>(page.hasMore);
  expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
    page.items[0]!.metadata,
  );
});
expectError(client.avatars.list({ pagination: { limit: 20 } }));
expectNotAssignable<NonNullable<Parameters<typeof client.documents.list>[0]>>({
  filter: { path: { unknown: { eq: 'value' } } },
});

expectAssignable<
  AsyncIterable<{
    id: string;
    metadata: { role: 'admin' | 'visitor'; type: 'profile' | 'post' };
    path: { author: string; type: string };
  }>
>(client.avatars.listAll({ limit: 50 }));

expectType<Promise<{ ref: EdgeStoreFileReference }>>(
  client.documents.confirm({ id: 'file-id' }),
);
expectType<Promise<{ ref: EdgeStoreFileReference }>>(
  client.documents.delete({ key: 'files/document.pdf' }),
);
expectType<Promise<{ ref: EdgeStoreFileReference }>>(
  client.documents.restore({ url: 'https://files.example/document.pdf' }),
);
void client.documents
  .deleteMany({ refs: [{ id: 'one' }, { key: 'files/two' }] })
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
expectType<number>({} as ClientOutputs['documents']['get']['sizeBytes']);
expectType<{ role: 'admin' | 'visitor'; type: 'profile' | 'post' }>(
  {} as ClientOutputs['avatars']['list']['items'][number]['metadata'],
);
expectType<{ author: string; type: string }>(
  {} as ClientOutputs['avatars']['upload']['path'],
);
expectType<EdgeStoreFileReference>(
  {} as ClientOutputs['documents']['delete']['ref'],
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

expectType<{ objectKey: string }>({} as SyntheticInputs['files']['get']);
expectType<number | undefined>(
  {} as NonNullable<SyntheticInputs['files']['list']>['cursor'],
);
expectType<{ objectKey: string }[]>(
  {} as SyntheticInputs['files']['deleteMany']['refs'],
);
expectType<{ objectKey: string }>(
  {} as SyntheticProtectedInputs['files']['createSignedUrl']['url'],
);
expectError(({} as SyntheticInputs['files']).restore);

expectType<string>({} as SyntheticOutputs['files']['upload']['eTag']);
expectType<number | null>(
  {} as SyntheticOutputs['files']['list']['nextCursor'],
);
expectType<'OBJECT_LOCKED'>(
  {} as SyntheticOutputs['files']['deleteMany']['failed'][number]['error']['code'],
);
expectType<'us-east-1'>(
  {} as SyntheticProtectedOutputs['files']['createSignedUrl']['providerRegion'],
);
expectError(({} as SyntheticOutputs['files']).restore);
