import {
  type AnyBuilder,
  type AnyEdgeStoreProvider,
  type AnyRouter,
  type BackendFile,
  type DefaultEdgeStoreProvider,
  type FileReference,
  type InferBucketPathKeys,
  type InferBucketPathObject,
  type InferBucketPathOrder,
  type InferMetadataObject,
  type InferSchemaInput,
  type MaybePromise,
  type Prettify,
  type ProviderCapability,
  type ProviderCapabilityFile,
  type ProviderCapabilityResult,
  type ProviderCursor,
  type ProviderFile,
  type ProviderFileMutationResult,
  type ProviderMutationError,
  type ProviderReference,
  type ProviderReferenceInput,
  type Simplify,
} from '@edgestore/shared';
import { createBucketClient } from './bucketClient';

type AnyBackendProvider = AnyEdgeStoreProvider;

export type SimpleOperator =
  'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'startsWith' | 'endsWith';

export type Comparison<TType = string> =
  TType | Partial<Record<SimpleOperator, TType> & { between: [TType, TType] }>;

export type EdgeStoreFileReference = FileReference;

type RouterFieldValue<TValue, TRouterValue> =
  TValue extends Record<string, string> ? TRouterValue : TValue;

type ProviderRouterField<
  TBucket extends AnyBuilder,
  TFile extends BackendFile,
  TKey extends 'metadata' | 'path',
> = TKey extends keyof TFile
  ? {
      [TField in keyof Pick<TFile, TKey>]: RouterFieldValue<
        Pick<TFile, TKey>[TField],
        TKey extends 'metadata'
          ? InferMetadataObject<TBucket>
          : InferBucketPathObject<TBucket>
      >;
    }
  : object;

type ProviderRouterFields<
  TBucket extends AnyBuilder,
  TFile extends BackendFile,
> = ProviderRouterField<TBucket, TFile, 'metadata'> &
  ProviderRouterField<TBucket, TFile, 'path'>;

type ProviderFileFields<
  TBucket extends AnyBuilder,
  TFile extends BackendFile,
> = TFile extends ProviderFile
  ? Omit<ProviderFile, 'metadata' | 'path'> &
      Omit<TFile, keyof ProviderFile> &
      ProviderRouterFields<TBucket, TFile>
  : Omit<TFile, 'metadata' | 'path' | 'uploadedAt' | 'updatedAt'> & {
      uploadedAt: Date;
      updatedAt: Date;
    } & ProviderRouterFields<TBucket, TFile>;

export type FileRecord<
  TBucket extends AnyBuilder,
  TFile extends BackendFile = ProviderFile,
> = ProviderFileFields<TBucket, TFile>;

type RouterFileFields<TBucket extends AnyBuilder> = {
  metadata: InferMetadataObject<TBucket>;
  path: InferBucketPathObject<TBucket>;
};

export type GetFileRes<
  TBucket extends AnyBuilder,
  TFile extends BackendFile = ProviderFile,
> = FileRecord<TBucket, TFile>;

export type UploadOptions = {
  /**
   * e.g. 'my-file-name.jpg'
   *
   * By default, a unique file name will be generated for each upload.
   * If you want to use a custom file name, you can use this option.
   * If you use the same file name for multiple uploads, the previous file will be overwritten.
   * But it might take some time for the CDN cache to be cleared.
   * So maybe you will keep seeing the old file for a while.
   *
   * If you want to replace an existing file, immediately leave the `manualFileName` option empty and use the `replaceTargetUrl` option.
   */
  manualFileName?: string;
  /**
   * Use this to replace an existing file.
   * It will automatically delete the existing file when the upload is complete.
   */
  replaceTargetUrl?: string;
  /**
   * If true, the file needs to be confirmed by using the `confirm` function.
   * If the file is not confirmed within 24 hours, it will be deleted.
   *
   * This is useful for pages where the file is uploaded as soon as it is selected,
   * but the user can leave the page without submitting the form.
   *
   * This avoids unnecessary zombie files in the bucket.
   */
  temporary?: boolean;
  /**
   * Transform the file before it is validated and uploaded.
   *
   * This can be used to compress images, convert formats, encrypt files, etc.
   * The transformed blob's size, MIME type, and extension will be used for the
   * upload request.
   */
  transform?: ServerUploadTransform;
};

type TextContent = string;
type BlobContent = {
  blob: Blob;
  extension: string;
};
type UrlContent = {
  url: string;
  extension: string;
};

export type UploadContent = TextContent | BlobContent | UrlContent;

export type ServerUploadTransform = (params: {
  blob: Blob;
  extension: string;
  type: string;
}) => MaybePromise<{
  blob: Blob;
  extension: string;
}>;

export type UploadFileRequest<TBucket extends AnyBuilder> = {
  /**
   * Can be a string, a blob or an url.
   *
   * If it's a string, it will be converted to a blob with the type `text/plain`.
   *
   * @example
   * // string
   * content: "some text"
   *
   * @example
   * // blob
   * content: {
   *   blob: new Blob([text], { type: "text/csv" }),
   *   extension: "csv",
   * }
   *
   * @example
   * // url
   * content: {
   *   url: "https://example.com/my-file.csv",
   *   extension: "csv",
   * }
   */
  content: UploadContent;
  options?: UploadOptions;
  signal?: AbortSignal;
  onProgress?: (progress: {
    transferredBytes: number;
    totalBytes: number;
    percentage: number;
    phase: 'preparing' | 'uploading' | 'processing';
  }) => void;
} & (TBucket['$config']['ctx'] extends Record<string, never>
  ? {}
  : {
      ctx: TBucket['$config']['ctx'];
    }) &
  (TBucket['_def']['input'] extends undefined
    ? {}
    : {
        input: InferSchemaInput<TBucket['_def']['input']>;
      });

export type UploadFileRes<
  TBucket extends AnyBuilder,
  TFile extends BackendFile = ProviderFile,
> = Omit<FileRecord<TBucket, TFile>, 'metadata' | 'path'> &
  RouterFileFields<TBucket> & {
    pathOrder: InferBucketPathOrder<TBucket>;
  } & (undefined extends TBucket['_def']['autoSignedUrls']
    ? unknown
    : {
        signedUrl: string;
        expiresAt: Date;
        expiresIn: number;
        signedThumbnailUrl?: string | null;
      });

type Filter<TBucket extends AnyBuilder> = {
  AND?: Filter<TBucket>[];
  OR?: Filter<TBucket>[];
  uploadedAt?: Comparison<Date>;
  path?: {
    [K in InferBucketPathKeys<TBucket>]?: Comparison;
  };
  metadata?: {
    [K in keyof InferMetadataObject<TBucket>]?: Comparison;
  };
};

export type ListFilesRequest<TBucket extends AnyBuilder, TCursor = string> = {
  filter?: Filter<TBucket>;
  cursor?: TCursor;
  limit?: number;
};

export type ListFilesResponse<
  TBucket extends AnyBuilder,
  TFile extends BackendFile = ProviderFile,
  TCursor = string,
> = {
  items: Prettify<FileRecord<TBucket, TFile>>[];
  limit: number;
  nextCursor: TCursor | null;
  hasMore: boolean;
};

export type FileMutationFailure<
  TFileReference = FileReference,
  TError = Extract<
    ProviderFileMutationResult['results'][number],
    { success: false }
  >['error'],
> = {
  ref: TFileReference;
  error: TError;
};

export type FileMutationResult<
  TFileReference = FileReference,
  TError = Extract<
    ProviderFileMutationResult['results'][number],
    { success: false }
  >['error'],
> = {
  succeeded: TFileReference[];
  failed: FileMutationFailure<TFileReference, TError>[];
};

export type FileMutationSuccess<TFileReference = FileReference> = {
  ref: TFileReference;
};

export { EdgeStoreFileMutationError } from '@edgestore/sdk';

type SignedUrlResult<TBucket extends AnyBuilder, TProvider> =
  ProviderCapabilityResult<TProvider, 'getSignedUrls'> extends (infer TResult)[]
    ? TResult extends { expiresAt: Date | string }
      ? TBucket['_def']['type'] extends 'IMAGE'
        ? TResult & { expiresAt: Date }
        : Omit<TResult, 'thumbnailUrl' | 'signedThumbnailUrl'> & {
            expiresAt: Date;
          }
      : TResult
    : never;

type UploadBucketClient<TBucket extends AnyBuilder, TProvider> = [
  ProviderCapability<TProvider, 'upload'>,
] extends [never]
  ? object
  : {
      /** Upload a file directly from the backend. */
      upload: (
        params: Prettify<UploadFileRequest<TBucket>>,
      ) => Promise<
        Prettify<
          UploadFileRes<TBucket, ProviderCapabilityFile<TProvider, 'upload'>>
        >
      >;
    };

type GetFileBucketClient<TBucket extends AnyBuilder, TProvider> = [
  ProviderCapability<TProvider, 'get'>,
] extends [never]
  ? object
  : {
      get: (
        ref: ProviderReferenceInput<TProvider>,
      ) => Promise<
        Prettify<FileRecord<TBucket, ProviderCapabilityFile<TProvider, 'get'>>>
      >;
    };

type MutationBucketClient<
  TProvider,
  TCapability extends 'confirm' | 'delete' | 'restore',
  TSingleName extends string,
  TManyName extends string,
> = [ProviderCapability<TProvider, TCapability>] extends [never]
  ? object
  : {
      [TKey in TSingleName]: (
        ref: ProviderReferenceInput<TProvider>,
      ) => Promise<FileMutationSuccess<ProviderReference<TProvider>>>;
    } & {
      [TKey in TManyName]: (params: {
        refs: ProviderReferenceInput<TProvider>[];
      }) => Promise<
        FileMutationResult<
          ProviderReference<TProvider>,
          ProviderMutationError<TProvider, TCapability>
        >
      >;
    };

type ListBucketClient<TBucket extends AnyBuilder, TProvider> = [
  ProviderCapability<TProvider, 'list'>,
] extends [never]
  ? object
  : {
      list: (
        params?: ListFilesRequest<TBucket, ProviderCursor<TProvider>>,
      ) => Promise<{
        items: Prettify<
          FileRecord<TBucket, ProviderCapabilityFile<TProvider, 'list'>>
        >[];
        limit: number;
        nextCursor: ProviderCursor<TProvider> | null;
        hasMore: boolean;
      }>;
    };

type SignedUrlBucketClient<TBucket extends AnyBuilder, TProvider> = [
  ProviderCapability<TProvider, 'getSignedUrls'>,
] extends [never]
  ? object
  : undefined extends TBucket['_def']['accessControl']
    ? object
    : {
        createSignedUrl: (params: {
          url: ProviderReferenceInput<TProvider>;
          expiresIn?: number;
        }) => Promise<Prettify<SignedUrlResult<TBucket, TProvider>>>;
        createSignedUrls: (params: {
          urls: ProviderReferenceInput<TProvider>[];
          expiresIn?: number;
          includeThumbnails?: boolean;
        }) => Promise<Prettify<SignedUrlResult<TBucket, TProvider>>[]>;
      };

export type BucketClient<
  TBucket extends AnyBuilder,
  TProvider extends AnyBackendProvider,
> = UploadBucketClient<TBucket, TProvider> &
  GetFileBucketClient<TBucket, TProvider> &
  MutationBucketClient<TProvider, 'confirm', 'confirm', 'confirmMany'> &
  MutationBucketClient<TProvider, 'delete', 'delete', 'deleteMany'> &
  MutationBucketClient<TProvider, 'restore', 'restore', 'restoreMany'> &
  ListBucketClient<TBucket, TProvider> &
  SignedUrlBucketClient<TBucket, TProvider>;

export type EdgeStoreClient<
  TRouter extends AnyRouter,
  TProvider extends AnyBackendProvider = DefaultEdgeStoreProvider,
> = {
  [K in keyof TRouter['buckets']]: BucketClient<
    TRouter['buckets'][K],
    TProvider
  >;
};

export function createBackendClient<
  TRouter extends AnyRouter,
  TProvider extends AnyBackendProvider,
>(
  router: TRouter,
  provider: TProvider,
  baseUrl?: string,
): EdgeStoreClient<TRouter, TProvider> {
  const bucketNames = Object.keys(router.buckets) as (keyof TRouter['buckets'] &
    string)[];
  const entries = bucketNames.map((bucketName) => [
    bucketName,
    createBucketClient(router, bucketName, { provider, baseUrl }),
  ]);

  return Object.fromEntries(entries) as EdgeStoreClient<TRouter, TProvider>;
}

type ClientMethodInput<TMethod> = TMethod extends (
  ...args: infer TArgs
) => unknown
  ? TArgs[0]
  : never;

type ClientMethodOutput<TMethod> = TMethod extends (
  ...args: any
) => infer TResult
  ? Simplify<Awaited<TResult>>
  : never;

/**
 * Infers the input accepted by every method on a router-derived backend client.
 */
export type InferClientInputs<
  TRouter extends AnyRouter,
  TProvider extends AnyBackendProvider = DefaultEdgeStoreProvider,
> = {
  [TBucketName in keyof TRouter['buckets']]: {
    [
      TClientFn in keyof EdgeStoreClient<TRouter, TProvider>[TBucketName]
    ]: ClientMethodInput<
      EdgeStoreClient<TRouter, TProvider>[TBucketName][TClientFn]
    >;
  };
};

/**
 * Infers the resolved output of every method on a router-derived backend
 * client.
 */
export type InferClientOutputs<
  TRouter extends AnyRouter,
  TProvider extends AnyBackendProvider = DefaultEdgeStoreProvider,
> = {
  [TBucketName in keyof TRouter['buckets']]: {
    [
      TClientFn in keyof EdgeStoreClient<TRouter, TProvider>[TBucketName]
    ]: ClientMethodOutput<
      EdgeStoreClient<TRouter, TProvider>[TBucketName][TClientFn]
    >;
  };
};

/**
 * @deprecated Use {@link InferClientOutputs} instead.
 */
export type InferClientResponse<
  TRouter extends AnyRouter,
  TProvider extends AnyBackendProvider = DefaultEdgeStoreProvider,
> = InferClientOutputs<TRouter, TProvider>;
