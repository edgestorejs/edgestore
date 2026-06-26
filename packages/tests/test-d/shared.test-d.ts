import {
  initEdgeStore,
  type AccessControlSchema,
  type InferBucketPathObject,
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

expectType<{ author: string; type: string }>(
  {} as InferBucketPathObject<typeof imageBucket>,
);
expectType<{ role: 'admin' | 'visitor'; extension: string | undefined }>(
  {} as InferMetadataObject<typeof imageBucket>,
);
expectType<{ author: string }>({} as InferBucketPathObject<typeof fileBucket>);

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
