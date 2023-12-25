import { z } from 'zod';
import { type KeysOfUnion, type MaybePromise, type Simplify } from '../types';
import { createPathParamProxy } from './createPathParamProxy';

type Merge<TType, TWith> = {
  [TKey in keyof TType | keyof TWith]?: TKey extends keyof TType
    ? TKey extends keyof TWith
      ? TType[TKey] & TWith[TKey]
      : TType[TKey]
    : TWith[TKey & keyof TWith];
};

type ConvertStringToFunction<TType> = {
  [K in keyof TType]: TType[K] extends object
    ? Simplify<ConvertStringToFunction<TType[K]>>
    : () => string;
};

type UnionToIntersection<TType> = (
  TType extends any ? (k: TType) => void : never
) extends (k: infer I) => void
  ? I
  : never;

export type InferBucketPathKeys<TBucket extends Builder<any, AnyDef>> =
  KeysOfUnion<TBucket['_def']['path'][number]>;

type InferBucketPathKeysFromDef<TDef extends AnyDef> = KeysOfUnion<
  TDef['path'][number]
>;

export type InferBucketPathObject<TBucket extends Builder<any, AnyDef>> =
  InferBucketPathKeys<TBucket> extends never
    ? Record<string, never>
    : {
        [TKey in InferBucketPathKeys<TBucket>]: string;
      };

export type InferBucketPathObjectFromDef<TDef extends AnyDef> =
  InferBucketPathKeysFromDef<TDef> extends never
    ? Record<string, never>
    : {
        [TKey in InferBucketPathKeysFromDef<TDef>]: string;
      };

export type InferMetadataObject<TBucket extends Builder<any, AnyDef>> =
  TBucket['_def']['metadata'] extends (...args: any) => any
    ? Awaited<ReturnType<TBucket['_def']['metadata']>>
    : Record<string, never>;

type InferMetadataObjectFromDef<TDef extends AnyDef> =
  TDef['metadata'] extends (...args: any) => any
    ? Awaited<ReturnType<TDef['metadata']>>
    : Record<string, never>;

export type AnyContext = Record<string, string | undefined | null>;

export type AnyInput = z.AnyZodObject | z.ZodNever;

export type AnyPath = Record<string, () => string>[];

type PathParam<TPath extends AnyPath> = {
  path: keyof UnionToIntersection<TPath[number]>;
};

type Conditions<TPath extends AnyPath> = {
  eq?: string | PathParam<TPath>;
  lt?: string | PathParam<TPath>;
  lte?: string | PathParam<TPath>;
  gt?: string | PathParam<TPath>;
  gte?: string | PathParam<TPath>;
  contains?: string | PathParam<TPath>;
  in?: string | PathParam<TPath> | (string | PathParam<TPath>)[];
  not?: string | PathParam<TPath> | Conditions<TPath>;
};

export type AccessControlSchema<TCtx, TDef extends AnyDef> = Merge<
  {
    [TKey in keyof TCtx]?:
      | string
      | PathParam<TDef['path']>
      | Conditions<TDef['path']>;
  },
  {
    OR?: AccessControlSchema<TCtx, TDef>[];
    AND?: AccessControlSchema<TCtx, TDef>[];
    NOT?: AccessControlSchema<TCtx, TDef>[];
  }
>;

type BucketConfig = {
  /**
   * Maximum size for a single file in bytes
   *
   * e.g. 1024 * 1024 * 10 = 10MB
   */
  maxSize?: number;
  /**
   * Accepted MIME types
   *
   * e.g. ['image/jpeg', 'image/png']
   *
   * You can also use wildcards after the slash:
   *
   * e.g. ['image/*']
   */
  accept?: string[];
};

type FileInfo = {
  size: number;
  type: string;
  extension: string;
  fileName?: string;
  replaceTargetUrl?: string;
  temporary: boolean;
};

type BeforeUploadFn<TCtx, TDef extends AnyDef> = (params: {
  ctx: TCtx;
  input: z.infer<TDef['input']>;
  fileInfo: FileInfo;
}) => MaybePromise<boolean>;

type BeforeDeleteFn<TCtx, TDef extends AnyDef> = (params: {
  ctx: TCtx;
  fileInfo: {
    url: string;
    size: number;
    uploadedAt: Date;
    path: InferBucketPathObjectFromDef<TDef>;
    metadata: InferMetadataObjectFromDef<TDef>;
  };
}) => MaybePromise<boolean>;

export type AnyMetadata = Record<string, string | undefined | null>;

type MetadataFn<
  TCtx,
  TInput extends AnyInput,
  TMetadata extends AnyMetadata,
> = (params: { ctx: TCtx; input: z.infer<TInput> }) => MaybePromise<TMetadata>;

export type AnyMetadataFn = MetadataFn<any, AnyInput, AnyMetadata>;

type BucketType = 'IMAGE' | 'FILE';

type Def<
  TInput extends AnyInput,
  TPath extends AnyPath,
  TMetadata extends AnyMetadataFn,
> = {
  type: BucketType;
  input: TInput;
  path: TPath;
  metadata: TMetadata;
  bucketConfig?: BucketConfig;
  accessControl?: AccessControlSchema<any, any>;
  beforeUpload?: BeforeUploadFn<any, any>;
  beforeDelete?: BeforeDeleteFn<any, any>;
};

type AnyDef = Def<AnyInput, AnyPath, AnyMetadataFn>;

type Builder<TCtx, TDef extends AnyDef> = {
  /** only used for types */
  $config: {
    ctx: TCtx;
  };
  /**
   * @internal
   */
  _def: TDef;
  /**
   * You can set an input that will be required in every upload from the client.
   *
   * This can be used to add additional information to the file, like choose the file path or add metadata.
   */
  input<TInput extends AnyInput>(
    input: TInput,
  ): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TInput;
      path: TDef['path'];
      metadata: TDef['metadata'];
      bucketConfig: TDef['bucketConfig'];
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
      beforeDelete: TDef['beforeDelete'];
    }
  >;
  /**
   * The `path` is similar to folders in a file system.
   * But in this case, every segment of the path must have a meaning.
   *
   * ```
   * // e.g. 123/profile/file.jpg
   * {
   *   author: '123',
   *   type: 'profile',
   * }
   * ```
   */
  path<TParams extends AnyPath>(
    pathResolver: (params: {
      ctx: Simplify<ConvertStringToFunction<TCtx>>;
      input: Simplify<ConvertStringToFunction<z.infer<TDef['input']>>>;
    }) => [...TParams],
  ): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TParams;
      metadata: TDef['metadata'];
      bucketConfig: TDef['bucketConfig'];
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
      beforeDelete: TDef['beforeDelete'];
    }
  >;
  /**
   * This metadata will be added to every file uploaded to this bucket.
   *
   * This can be used, for example, to filter files.
   */
  metadata<TMetadata extends AnyMetadata>(
    metadata: MetadataFn<TCtx, TDef['input'], TMetadata>,
  ): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      metadata: MetadataFn<any, any, TMetadata>;
      bucketConfig: TDef['bucketConfig'];
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
      beforeDelete: TDef['beforeDelete'];
    }
  >;
  /**
   * If you set this, your bucket will automatically be configured as a protected bucket.
   *
   * This means that images will only be accessible from within your app.
   * And only if it passes the check set in this function.
   */
  accessControl(accessControl: AccessControlSchema<TCtx, TDef>): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      metadata: TDef['metadata'];
      bucketConfig: TDef['bucketConfig'];
      accessControl: AccessControlSchema<any, any>;
      beforeUpload: TDef['beforeUpload'];
      beforeDelete: TDef['beforeDelete'];
    }
  >;
  /**
   * return `true` to allow upload
   *
   * By default every upload from your app is allowed.
   */
  beforeUpload(beforeUpload: BeforeUploadFn<TCtx, TDef>): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      metadata: TDef['metadata'];
      bucketConfig: TDef['bucketConfig'];
      accessControl: TDef['accessControl'];
      beforeUpload: BeforeUploadFn<any, any>;
      beforeDelete: TDef['beforeDelete'];
    }
  >;
  /**
   * return `true` to allow delete
   *
   * This function must be defined if you want to delete files directly from the client.
   */
  beforeDelete(beforeDelete: BeforeDeleteFn<TCtx, TDef>): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      metadata: TDef['metadata'];
      bucketConfig: TDef['bucketConfig'];
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
      beforeDelete: BeforeDeleteFn<any, any>;
    }
  >;
};

export type AnyBuilder = Builder<any, AnyDef>;

const createNewBuilder = (initDef: AnyDef, newDef: Partial<AnyDef>) => {
  const mergedDef = {
    ...initDef,
    ...newDef,
  };
  return createBuilder(
    {
      type: mergedDef.type,
    },
    mergedDef,
  );
};

function createBuilder<
  TCtx,
  TType extends BucketType,
  TInput extends AnyInput = z.ZodNever,
  TPath extends AnyPath = [],
  TMetadata extends AnyMetadataFn = () => Record<string, never>,
>(
  opts: { type: TType },
  initDef?: Partial<AnyDef>,
): Builder<
  TCtx,
  {
    type: TType;
    input: TInput;
    path: TPath;
    metadata: TMetadata;
    bucketConfig?: BucketConfig;
    accessControl?: AccessControlSchema<any, any>;
    beforeUpload?: BeforeUploadFn<any, any>;
    beforeDelete?: BeforeDeleteFn<any, any>;
  }
> {
  const _def: AnyDef = {
    type: opts.type,
    input: z.never(),
    path: [],
    metadata: () => ({}),
    ...initDef,
  };

  return {
    $config: {
      ctx: undefined as TCtx,
    },
    // @ts-expect-error - I think it would be too much work to make this type correct.
    _def,
    input(input) {
      return createNewBuilder(_def, {
        input,
      }) as any;
    },
    path(pathResolver) {
      // TODO: Should throw a runtime error in the following cases:
      // 1. in case of multiple keys in one object
      // 2. in case of duplicate keys
      const pathParamProxy = createPathParamProxy();
      const params = pathResolver(pathParamProxy);
      return createNewBuilder(_def, {
        path: params,
      }) as any;
    },
    metadata(metadata) {
      return createNewBuilder(_def, {
        metadata,
      }) as any;
    },
    accessControl(accessControl) {
      return createNewBuilder(_def, {
        accessControl: accessControl,
      }) as any;
    },
    beforeUpload(beforeUpload) {
      return createNewBuilder(_def, {
        beforeUpload,
      }) as any;
    },
    beforeDelete(beforeDelete) {
      return createNewBuilder(_def, {
        beforeDelete,
      }) as any;
    },
  };
}

class EdgeStoreBuilder<TCtx = Record<string, never>> {
  context<TNewContext extends AnyContext>() {
    return new EdgeStoreBuilder<TNewContext>();
  }

  create() {
    return createEdgeStoreInner<TCtx>()();
  }
}

export type EdgeStoreRouter<TCtx> = {
  /**
   * Only used for types
   * @internal
   */
  $config: {
    ctx: TCtx;
  };
  buckets: Record<string, Builder<TCtx, AnyDef>>;
};

export type AnyRouter = EdgeStoreRouter<any>;

function createRouterFactory<TCtx>() {
  return function createRouterInner<
    TBuckets extends EdgeStoreRouter<TCtx>['buckets'],
  >(buckets: TBuckets) {
    return {
      $config: {
        ctx: undefined as TCtx,
      },
      buckets,
    } satisfies EdgeStoreRouter<TCtx>;
  };
}

function initBucket<TCtx, TType extends BucketType>(
  type: TType,
  config?: BucketConfig,
) {
  return createBuilder<TCtx, TType>({ type }, { bucketConfig: config });
}

function createEdgeStoreInner<TCtx>() {
  return function initEdgeStoreInner() {
    return {
      /**
       * Builder object for creating an image bucket
       */
      imageBucket(config?: BucketConfig) {
        return initBucket<TCtx, 'IMAGE'>('IMAGE', config);
      },
      /**
       * Builder object for creating a file bucket
       */
      fileBucket(config?: BucketConfig) {
        return initBucket<TCtx, 'FILE'>('FILE', config);
      },
      /**
       * Create a router
       */
      router: createRouterFactory<TCtx>(),
    };
  };
}

/**
 * Initialize EdgeStore - be done exactly once per backend
 */
export const initEdgeStore = new EdgeStoreBuilder();

// ↓↓↓ TYPE TESTS ↓↓↓

// type Context = {
//   userId: string;
//   userRole: 'admin' | 'visitor';
// };

// const es = initEdgeStore.context<Context>().create();

// const imagesBucket = es.imageBucket()
//   .input(
//     z.object({
//       type: z.enum(['profile', 'post']),
//       extension: z.string().optional(),
//     }),
//   )
//   .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
//   .metadata(({ ctx, input }) => ({
//     extension: input.extension,
//     role: ctx.userRole,
//   }))
//   .beforeUpload(() => {
//     return true;
//   });
// const a = es.imageBucket()
//   .input(z.object({ type: z.string(), someMeta: z.string().optional() }))
//   .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
//   .metadata(({ ctx, input }) => ({
//     role: ctx.userRole,
//     someMeta: input.someMeta,
//   }))
//   .accessControl({
//     OR: [
//       {
//         userId: { path: 'author' }, // this will check if the userId is the same as the author in the path parameter
//       },
//       {
//         userRole: 'admin', // this is the same as { userRole: { eq: "admin" } }
//       },
//     ],
//   })
//   .beforeUpload(({ ctx, input }) => {
//     return true;
//   })
//   .beforeDelete(({ ctx, file }) => {
//     return true;
//   });

// const b = es.imageBucket().path(({ ctx }) => [{ author: ctx.userId }]);

// const router = es.router({
//   original: imagesBucket,
//   imageBucket: a,
//   imageBucket2: b,
// });

// export { router };

// type ListFilesResponse<TBucket extends AnyRouter['buckets'][string]> = {
//   data: {
//     // url: string;
//     // size: number;
//     // uploadedAt: Date;
//     // metadata: InferMetadataObject<TBucket>;
//     path: InferBucketPathKeys<TBucket> extends string ? {
//       [key: string]: string;
//     } :{
//       [TKey in InferBucketPathKeys<TBucket>]: string;
//     };
//   }[];
//   pagination: {
//     currentPage: number;
//     totalPages: number;
//     totalCount: number;
//   };
// };

// type TPathKeys = 'author' | 'type';
// type TPathKeys2 = InferBucketPathKeys<AnyBuilder>;

// type ObjectWithKeys<TKeys extends string> = {
//   [TKey in TKeys]: string;
// };

// type Test1 = ObjectWithKeys<TPathKeys>;
// type Test2 = ObjectWithKeys<TPathKeys2>;
// type PathKeys = InferBucketPathKeys<typeof router.buckets.imageBucket>;

// type MetadataKeys = InferMetadataObject<typeof router.buckets.imageBucket>;

// type MyEdgeStoreRouter = typeof router;

// type MyAccessControl = AccessControlSchema<Context, AnyDef>;
