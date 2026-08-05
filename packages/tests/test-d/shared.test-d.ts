import {
  initEdgeStore,
  type AccessControlSchema,
  type AnyContext,
  type EdgeStoreRouter,
  type InferBucketPathObject,
  type InferBucketPathOrder,
  type InferMetadataObject,
} from '@edgestore/shared';
import { expectAssignable, expectNotAssignable, expectType } from 'tsd';
import { z } from 'zod';

type Context = {
  userId: string;
  role: 'admin' | 'visitor';
};

const es = initEdgeStore.context<Context>().create();

const imageBucket = es
  .imageBucket()
  .input(
    z.object({
      type: z.enum(['profile', 'post']),
      extension: z.string().optional(),
    }),
  )
  .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
  .metadata(({ ctx, input }) => ({
    role: ctx.role,
    extension: input.extension,
  }))
  .accessControl({
    OR: [{ userId: { path: 'author' } }, { role: 'admin' }],
  })
  .beforeUpload(({ ctx, input, fileInfo }) => {
    expectType<Context>(ctx);
    expectType<'profile' | 'post'>(input.type);
    expectType<string | undefined>(input.extension);
    expectType<string>(fileInfo.type);
    return true;
  })
  .beforeDelete(({ ctx, fileInfo }) => {
    expectType<Context>(ctx);
    expectType<{ author: string; type: string }>(fileInfo.path);
    expectType<{ role: 'admin' | 'visitor'; extension?: string }>(
      fileInfo.metadata,
    );
    return true;
  });

const fileBucket = es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]);
const privateFileBucket = es.fileBucket().accessControl('private');
const emptyBucket = es.fileBucket();
const broadMetadataBucket = es
  .fileBucket()
  .metadata((): Record<string, string | null | undefined> => ({
    present: 'value',
    absent: undefined,
  }));

expectType<{ author: string; type: string }>(
  {} as InferBucketPathObject<typeof imageBucket>,
);
expectType<('author' | 'type')[]>(
  {} as InferBucketPathOrder<typeof imageBucket>,
);
expectType<{ role: 'admin' | 'visitor'; extension?: string }>(
  {} as InferMetadataObject<typeof imageBucket>,
);
expectType<{ author: string }>({} as InferBucketPathObject<typeof fileBucket>);
expectType<[]>({} as InferBucketPathOrder<typeof emptyBucket>);
expectType<Record<string, string>>(
  {} as InferMetadataObject<typeof broadMetadataBucket>,
);

expectAssignable<AccessControlSchema<Context, typeof imageBucket._def>>({
  userId: { path: 'author' },
  role: {
    in: ['admin', 'visitor'],
  },
});

expectNotAssignable<AccessControlSchema<Context, typeof imageBucket._def>>({
  userId: { path: 'unknown' },
});
expectNotAssignable<AccessControlSchema<Context, typeof imageBucket._def>>({
  unknown: 'value',
});

const router = es.router({
  imageBucket,
  fileBucket,
  privateFileBucket,
});

expectType<typeof imageBucket>(router.buckets.imageBucket);
expectType<typeof fileBucket>(router.buckets.fileBucket);

type ExactRouter = EdgeStoreRouter<Context, typeof router.buckets>;
expectType<typeof imageBucket>({} as ExactRouter['buckets']['imageBucket']);
expectType<typeof fileBucket>({} as ExactRouter['buckets']['fileBucket']);

expectAssignable<AnyContext>({
  userId: 'user-1',
  role: undefined,
});

expectNotAssignable<AnyContext>({
  user: {
    id: 'user-1',
  },
});
// @ts-expect-error nested context values are not supported.
initEdgeStore.context<{ user: { id: string } }>().create();
expectNotAssignable<AnyContext>({ userId: null });
// @ts-expect-error null context values are not supported.
initEdgeStore.context<{ userId: null }>().create();
