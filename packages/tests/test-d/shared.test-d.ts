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
    expectType<{ role: 'admin' | 'visitor'; extension: string | undefined }>(
      fileInfo.metadata,
    );
    return true;
  });

const fileBucket = es.fileBucket().path(({ ctx }) => [{ author: ctx.userId }]);
const emptyBucket = es.fileBucket();

expectType<{ author: string; type: string }>(
  {} as InferBucketPathObject<typeof imageBucket>,
);
expectType<('author' | 'type')[]>(
  {} as InferBucketPathOrder<typeof imageBucket>,
);
expectType<{ role: 'admin' | 'visitor'; extension: string | undefined }>(
  {} as InferMetadataObject<typeof imageBucket>,
);
expectType<{ author: string }>({} as InferBucketPathObject<typeof fileBucket>);
expectType<[]>({} as InferBucketPathOrder<typeof emptyBucket>);

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
});

expectType<typeof imageBucket>(router.buckets.imageBucket);
expectType<typeof fileBucket>(router.buckets.fileBucket);

type ExactRouter = EdgeStoreRouter<Context, typeof router.buckets>;
expectType<typeof imageBucket>({} as ExactRouter['buckets']['imageBucket']);
expectType<typeof fileBucket>({} as ExactRouter['buckets']['fileBucket']);

type NestedContext = {
  user: {
    id: string;
    profile: {
      role: 'admin' | 'visitor';
    };
  };
};

const nestedEs = initEdgeStore.context<NestedContext>().create();
const nestedBucket = nestedEs
  .fileBucket()
  .path(({ ctx }) => [
    { author: ctx.user.id },
    { role: ctx.user.profile.role },
  ]);

expectType<{ author: string; role: string }>(
  {} as InferBucketPathObject<typeof nestedBucket>,
);

expectNotAssignable<AnyContext>({
  user: {
    id: 123,
  },
});
// @ts-expect-error context path leaves must be string-compatible.
initEdgeStore.context<{ user: { id: number } }>().create();
