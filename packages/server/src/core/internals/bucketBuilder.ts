import { z } from 'zod';
import { MaybePromise, Simplify } from '../../types';
import { createPathParamProxy } from './createPathParamProxy';

type Merge<TType, TWith> = {
  [TKey in keyof TType | keyof TWith]?: TKey extends keyof TType
    ? TKey extends keyof TWith
      ? TType[TKey] & TWith[TKey]
      : TType[TKey]
    : TWith[TKey & keyof TWith];
};

type OverwriteIfDefined<TType, TWith> = UnsetMarker extends TType
  ? TWith
  : Simplify<TType & TWith>;

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

type InputZodObject = z.AnyZodObject;

export type BucketPath = Record<string, () => string>[];

type PathParam<TPath extends BucketPath> = {
  path: keyof UnionToIntersection<TPath[number]>;
};

const unsetMarker = Symbol('unsetMarker');

type UnsetMarker = typeof unsetMarker;

type Conditions<TPath extends BucketPath> = {
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

type BeforeUploadFn<TCtx, TDef extends AnyDef> = (params: {
  ctx: TCtx;
  input: z.infer<TDef['input']>;
}) => MaybePromise<boolean>;

type MetadataFn<TCtx, TDef extends AnyDef> = (params: {
  ctx: TCtx;
  input: z.infer<TDef['input']>;
}) => MaybePromise<Record<string, any>>;

type BucketType = 'IMAGE' | 'FILE';

type Def<TInput extends InputZodObject, TPath extends BucketPath> = {
  type: BucketType;
  input: TInput;
  path: TPath;
  metadata?: MetadataFn<any, any>;
  accessControl?: AccessControlSchema<any, any>;
  beforeUpload?: BeforeUploadFn<any, any>;
};

type AnyDef = Def<any, any>;

type Builder<TCtx, TDef extends AnyDef> = {
  /**
   * @internal
   */
  _def: TDef;
  input<TInput extends InputZodObject>(
    input: TInput,
  ): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: OverwriteIfDefined<TDef['input'], TInput>;
      path: TDef['path'];
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
    }
  >;
  path<TParams extends BucketPath>(
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
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
    }
  >;
  metadata(metadata: MetadataFn<TCtx, TDef>): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      accessControl: TDef['accessControl'];
      beforeUpload: TDef['beforeUpload'];
    }
  >;
  accessControl(accessControl: AccessControlSchema<TCtx, TDef>): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      accessControl: AccessControlSchema<any, any>;
      beforeUpload: TDef['beforeUpload'];
    }
  >;
  beforeUpload(beforeUpload: BeforeUploadFn<TCtx, TDef>): Builder<
    TCtx,
    {
      type: TDef['type'];
      input: TDef['input'];
      path: TDef['path'];
      accessControl: TDef['accessControl'];
      beforeUpload: BeforeUploadFn<TCtx, TDef>;
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

function createBuilder<TCtx>(
  opts: { type: BucketType },
  initDef?: Partial<AnyDef>,
): Builder<
  TCtx,
  {
    type: BucketType;
    input: UnsetMarker;
    path: UnsetMarker;
    accessControl?: AccessControlSchema<any, any>;
    beforeUpload?: BeforeUploadFn<any, any>;
  }
> {
  const _def: AnyDef = {
    type: opts.type,
    input: z.never(),
    path: [],
    ...initDef,
  };

  return {
    _def,
    input(input) {
      return createNewBuilder(_def, {
        input,
      }) as any;
    },
    path(pathResolver) {
      // TODO: Should throw a runtime error in the followin cases:
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
  };
}

class EdgeStoreBuilder<TCtx = object> {
  context<TNewContext extends Record<string, string>>() {
    return new EdgeStoreBuilder<TNewContext>();
  }

  create() {
    return createEdgeStoreInner<TCtx>()();
  }
}

export type EdgeStoreRouter<TCtx> = {
  routes: Record<string, Builder<TCtx, AnyDef>>;
};

function createRouterFactory<TCtx>() {
  return function createRouterInner<
    TRoutes extends EdgeStoreRouter<TCtx>['routes'],
  >(routes: TRoutes) {
    return {
      routes,
    };
  };
}

function createEdgeStoreInner<TCtx>() {
  return function initEdgeStoreInner() {
    return {
      /**
       * Builder object for creating an image bucket
       */
      imageBucket: createBuilder<TCtx>({ type: 'IMAGE' }),
      /**
       * Builder object for creating a file bucket
       */
      fileBucket: createBuilder<TCtx>({ type: 'FILE' }),
      /**
       * Create a router
       */
      router: createRouterFactory<TCtx>(),
    };
  };
}

/**
 * Initialize tRPC - be done exactly once per backend
 */
export const initEdgeStore = new EdgeStoreBuilder();

// ↓↓↓ TYPE TESTS ↓↓↓

// type Context = {
//   userId: string;
//   userRole: "admin" | "visitor";
// };

// const es = initEdgeStore.context<Context>().create();

// const imagesBucket = es.imageBucket
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
// const a = es.imageBucket
//   .input(z.object({ type: z.string(), someMeta: z.string().optional() }))
//   .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
//   .metadata(({ ctx, input }) => ({
//     role: ctx.userRole,
//     someMeta: input.someMeta,
//   }))
//   .accessControl({
//     OR: [
//       {
//         userId: { path: "author" }, // this will check if the userId is the same as the author in the path parameter
//       },
//       {
//         userRole: "admin", // this is the same as { userRole: { eq: "admin" } }
//       },
//     ],
//   })
//   .beforeUpload(({ ctx, input }) => {
//     return true;
//   });

// const b = es.imageBucket.path(({ ctx }) => [{ author: ctx.userId }]);

// const router = es.router({
//   imageBucket: a,
//   imageBucket2: b,
// });

// type EdgeStoreRouter = typeof router;

// type MyAccessControl = AccessControlSchema<Context, AnyDef>;
