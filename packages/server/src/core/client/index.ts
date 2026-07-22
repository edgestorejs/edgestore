/* eslint-disable @typescript-eslint/ban-types */
import {
  type AnyBuilder,
  type AnyRouter,
  type BackendClientProvider,
  type FileReference,
  type InferBucketPathKeys,
  type InferBucketPathObject,
  type InferBucketPathOrder,
  type InferMetadataObject,
  type MaybePromise,
  type Prettify,
  type ProviderFile,
  type ProviderFileMutationResult,
  type ProviderFilterValue,
  type ListFilesFilter as ProviderListFilesFilter,
  type Simplify,
} from '@edgestore/shared';
import { ZodNever, type z } from 'zod';
import { buildPath, isDev, parsePath } from '../../adapters/shared';
import { edgestore } from '../../providers/edgestore';
import { validateFileForBucket } from '../validateFile';

export type SimpleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'startsWith'
  | 'endsWith';

export type Comparison<TType = string> =
  | TType
  | Partial<Record<SimpleOperator, TType> & { between: [TType, TType] }>;

export type EdgeStoreFileReference = FileReference;

export type FileRecord<TBucket extends AnyBuilder> = Omit<
  ProviderFile,
  'metadata' | 'path'
> & {
  metadata: InferMetadataObject<TBucket>;
  path: InferBucketPathObject<TBucket>;
};

export type GetFileRes<TBucket extends AnyBuilder> = FileRecord<TBucket>;

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
   * If true, the file needs to be confirmed by using the `confirmUpload` function.
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

// type guard for `content`
function isTextContent(
  content: TextContent | BlobContent | UrlContent,
): content is TextContent {
  return typeof content === 'string';
}

function isBlobContent(
  content: TextContent | BlobContent | UrlContent,
): content is BlobContent {
  return typeof content !== 'string' && 'blob' in content;
}

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
  (TBucket['_def']['input'] extends ZodNever
    ? {}
    : {
        input: z.infer<TBucket['_def']['input']>;
      });

type UploadImplementationParams = {
  content: UploadContent;
  ctx?: Record<string, unknown>;
  input?: Record<string, unknown>;
};

export type UploadFileRes<TBucket extends AnyBuilder> = FileRecord<TBucket> & {
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

export type ListFilesRequest<TBucket extends AnyBuilder> = {
  filter?: Filter<TBucket>;
  cursor?: string;
  limit?: number;
};

export type ListFilesResponse<TBucket extends AnyBuilder> = {
  items: Prettify<FileRecord<TBucket>>[];
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export type ListAllFilesRequest<TBucket extends AnyBuilder> = {
  filter?: Filter<TBucket>;
  /** Number of files fetched per API request. */
  limit?: number;
};

export type FileMutationFailure = {
  ref: FileReference;
  error: Extract<
    ProviderFileMutationResult['results'][number],
    { success: false }
  >['error'];
};

export type FileMutationResult = {
  succeeded: FileReference[];
  failed: FileMutationFailure[];
};

export type FileMutationSuccess = { ref: FileReference };

export class EdgeStoreFileMutationError extends Error {
  override readonly name = 'EdgeStoreFileMutationError';

  constructor(
    readonly code: FileMutationFailure['error']['code'],
    message: string,
    readonly ref: FileReference,
  ) {
    super(message);
  }
}

type GetSignedUrlRes = {
  url: string;
  signedUrl: string;
  expiresAt: Date;
  expiresIn: number;
};

type GetSignedUrlsRes<TBucket extends AnyBuilder> =
  TBucket['_def']['type'] extends 'IMAGE'
    ? (GetSignedUrlRes & {
        thumbnailUrl?: string | null;
        signedThumbnailUrl?: string | null;
      })[]
    : GetSignedUrlRes[];

type BucketClient<TBucket extends AnyBuilder> = {
  getFile: (ref: FileReference) => Promise<Prettify<GetFileRes<TBucket>>>;

  /**
   * Use this function to upload a file to the bucket directly from your backend.
   *
   * @example
   * ```ts
   * // simple example
   * await backendClient.myBucket.upload({
   *   content: "some text",
   * });
   * ```
   *
   * @example
   * ```ts
   * // complete example
   * await backendClient.myBucket.upload({
   *   content: {
   *     blob: new Blob([text], { type: "text/csv" }),
   *     extension: "csv",
   *   },
   *   options: {
   *     temporary: true,
   *     replaceTargetUrl: replaceUrl,
   *     manualFileName: "test.csv",
   *   },
   *   ctx: {
   *     userId: "123",
   *     userRole: "admin",
   *   },
   *   input: {
   *     type: "post",
   *   },
   * });
   * ```
   */
  upload: (
    params: Prettify<UploadFileRequest<TBucket>>,
  ) => Promise<Prettify<UploadFileRes<TBucket>>>;
  /**
   * Confirm a temporary file upload directly from your backend.
   */
  confirmUpload: (ref: FileReference) => Promise<FileMutationSuccess>;
  /** Confirm temporary uploads while preserving per-file failures. */
  confirmUploads: (params: {
    refs: FileReference[];
  }) => Promise<FileMutationResult>;
  /**
   * Programmatically delete a file directly from your backend.
   */
  deleteFile: (ref: FileReference) => Promise<FileMutationSuccess>;
  /** Delete files while preserving per-file failures. */
  deleteFiles: (params: {
    refs: FileReference[];
  }) => Promise<FileMutationResult>;
  restoreFile: (ref: FileReference) => Promise<FileMutationSuccess>;
  /** Restore files while preserving per-file failures. */
  restoreFiles: (params: {
    refs: FileReference[];
  }) => Promise<FileMutationResult>;
  /**
   * List files in a bucket.
   *
   * You can also filter the results by passing a filter object.
   * The results are paginated.
   */
  listFiles: (
    params?: ListFilesRequest<TBucket>,
  ) => Promise<Prettify<ListFilesResponse<TBucket>>>;
  /** Iterate through every matching file without managing cursors manually. */
  listAllFiles: (
    params?: ListAllFilesRequest<TBucket>,
  ) => AsyncIterable<ListFilesResponse<TBucket>['items'][number]>;
} & (undefined extends TBucket['_def']['accessControl']
  ? unknown
  : {
      getSignedUrl: (params: {
        url: string;
        expiresIn?: number;
      }) => Promise<Prettify<GetSignedUrlRes>>;
      getSignedUrls: (params: {
        urls: string[];
        expiresIn?: number;
        includeThumbnails?: boolean;
      }) => Promise<Prettify<GetSignedUrlsRes<TBucket>[number]>[]>;
    });

type EdgeStoreClient<TRouter extends AnyRouter> = {
  [K in keyof TRouter['buckets']]: BucketClient<TRouter['buckets'][K]>;
};

export function createEdgeStoreClient<TRouter extends AnyRouter>(config: {
  router: TRouter;
  provider?: BackendClientProvider;
  accessKey?: string;
  secretKey?: string;
  /**
   * The base URL of your application.
   *
   * This is only needed for getting protected files in a development environment.
   *
   * @example http://localhost:3000/api/edgestore
   */
  baseUrl?: string;
}) {
  const provider =
    config.provider ??
    edgestore({ accessKey: config.accessKey, secretKey: config.secretKey });
  const entries = Object.entries(config.router.buckets).map(
    ([bucketName, bucket]) => {
      const bucketClient: EdgeStoreClient<TRouter>[string] = {
        async upload(params) {
          const {
            content,
            ctx = {},
            input = {},
          }: UploadImplementationParams = params;

          let { blob, extension } = await (async () => {
            if (isTextContent(content)) {
              return {
                blob: new Blob([content], { type: 'text/plain' }),
                extension: 'txt',
              };
            } else if (isBlobContent(content)) {
              return {
                blob: content.blob,
                extension: content.extension,
              };
            } else {
              return {
                blob: await getBlobFromUrl(content.url, params.signal),
                extension: content.extension,
              };
            }
          })();

          if (params.options?.transform) {
            const transformed = await params.options.transform({
              blob,
              extension,
              type: blob.type,
            });
            blob = transformed.blob;
            extension = transformed.extension;
          }

          const parsedInput =
            bucket._def.input instanceof ZodNever
              ? {}
              : await bucket._def.input.parseAsync(input);

          validateFileForBucket({
            bucket,
            fileInfo: { size: blob.size, type: blob.type },
          });

          const path = buildPath({
            bucket,
            pathAttrs: {
              ctx,
              input: parsedInput,
            },
            fileInfo: {
              type: blob.type,
              size: blob.size,
              extension,
              temporary: false,
              fileName: params.options?.manualFileName,
              replaceTargetUrl: params.options?.replaceTargetUrl,
            },
          });
          const metadata = await bucket._def.metadata({
            ctx,
            input: parsedInput,
          });
          const normalizedMetadata = normalizeMetadata(metadata);

          const uploadRes = await provider.backend.upload({
            bucketName,
            bucketType: bucket._def.type,
            autoSignedUrls: bucket._def.autoSignedUrls,
            source: blob,
            signal: params.signal,
            onProgress: params.onProgress,
            fileInfo: {
              fileName: params.options?.manualFileName,
              replaceTargetUrl: params.options?.replaceTargetUrl,
              type: blob.type,
              size: blob.size,
              extension,
              isPublic: bucket._def.accessControl === undefined,
              temporary: params.options?.temporary ?? false,
              path,
              metadata: normalizedMetadata,
            },
          });

          const { pathOrder } = parsePath(path);
          return {
            ...mapFileRecord(uploadRes.file, config.baseUrl),
            ...mapSignedReadAccess(uploadRes.signedReadUrl),
            pathOrder,
          } as unknown as UploadFileRes<TRouter['buckets'][string]>;
        },

        async getFile(ref) {
          const file = await provider.backend.getFile({ file: ref });
          return mapFileRecord(file, config.baseUrl) satisfies GetFileRes<
            typeof bucket
          > as GetFileRes<TRouter['buckets'][string]>;
        },

        async confirmUpload(ref) {
          return requireMutationSuccess(
            await provider.backend.confirmFiles({ files: [ref] }),
          );
        },

        async confirmUploads({ refs }) {
          return mapMutationResult(
            await provider.backend.confirmFiles({ files: refs }),
          );
        },

        async deleteFile(ref) {
          return requireMutationSuccess(
            await provider.backend.deleteFiles({ files: [ref] }),
          );
        },

        async deleteFiles({ refs }) {
          return mapMutationResult(
            await provider.backend.deleteFiles({ files: refs }),
          );
        },

        async restoreFile(ref) {
          return requireMutationSuccess(
            await provider.backend.restoreFiles({ files: [ref] }),
          );
        },

        async restoreFiles({ refs }) {
          return mapMutationResult(
            await provider.backend.restoreFiles({ files: refs }),
          );
        },

        async listFiles(params) {
          const res = await provider.backend.listFiles({
            bucketName,
            filter: serializeFilter(params?.filter),
            cursor: params?.cursor,
            limit: params?.limit,
          });

          const items = res.items.map((file) =>
            mapFileRecord(file, config.baseUrl),
          ) satisfies ListFilesResponse<
            typeof bucket
          >['items'] as ListFilesResponse<TRouter['buckets'][string]>['items'];

          return {
            ...res,
            items,
          };
        },

        async *listAllFiles(params) {
          let cursor: string | undefined;
          do {
            const page = await bucketClient.listFiles({
              filter: params?.filter,
              cursor,
              limit: params?.limit,
            });
            for (const file of page.items) yield file;
            cursor = page.nextCursor ?? undefined;
          } while (cursor);
        },

        async getSignedUrl(params: { url: string; expiresIn?: number }) {
          if (!provider.getSignedUrls) {
            throw unsupportedProviderOperation(provider, 'getSignedUrls');
          }
          const [signedUrl] = await provider.getSignedUrls({
            bucketName,
            urls: [params.url],
            expiresIn: params.expiresIn,
          });
          if (!signedUrl) {
            throw new Error('Missing signed URL response');
          }
          return {
            ...signedUrl,
            expiresAt: new Date(signedUrl.expiresAt),
          };
        },

        async getSignedUrls(params: {
          urls: string[];
          expiresIn?: number;
          includeThumbnails?: boolean;
        }) {
          if (!provider.getSignedUrls) {
            throw unsupportedProviderOperation(provider, 'getSignedUrls');
          }
          const signedUrls = await provider.getSignedUrls({
            bucketName,
            urls: params.urls,
            expiresIn: params.expiresIn,
            includeThumbnails: params.includeThumbnails,
          });
          return signedUrls.map((signedUrl) => ({
            ...signedUrl,
            expiresAt: new Date(signedUrl.expiresAt),
          })) as any;
        },
      };
      return [bucketName, bucketClient] as const;
    },
  );

  return Object.fromEntries(entries) as EdgeStoreClient<TRouter>;
}

/**
 * Protected files need third-party cookies to work.
 * Since third party cookies don't work on localhost,
 * we need to proxy the file through the server.
 */
function getUrl(url: string, baseUrl?: string) {
  if (isDev() && !url.includes('/_public/')) {
    if (!baseUrl) {
      throw new Error(
        'Missing baseUrl. You need to pass the baseUrl to `createEdgeStoreClient` to get protected files in development.',
      );
    }
    const proxyUrl = new URL(baseUrl);
    proxyUrl.pathname = `${proxyUrl.pathname}/proxy-file`;
    proxyUrl.search = new URLSearchParams({
      url,
    }).toString();
    return proxyUrl.toString();
  }
  return url;
}

async function getBlobFromUrl(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Could not fetch upload source: HTTP ${res.status}`);
  }
  return await res.blob();
}

function normalizeMetadata(
  metadata: Record<string, string | null | undefined>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => entry[1] != null,
    ),
  );
}

function serializeFilter<TBucket extends AnyBuilder>(
  filter: Filter<TBucket> | undefined,
): ProviderListFilesFilter | undefined {
  if (!filter) return undefined;
  return {
    uploadedAt: serializeComparison(filter.uploadedAt),
    path: serializeStringComparisons(filter.path),
    metadata: serializeStringComparisons(filter.metadata),
    AND: filter.AND?.map((item) => serializeFilter(item)!),
    OR: filter.OR?.map((item) => serializeFilter(item)!),
  };
}

function serializeComparison(
  value: Comparison<Date> | undefined,
): ProviderFilterValue | undefined {
  if (value instanceof Date) return value.toISOString();
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      Array.isArray(item)
        ? item.map((date) => date.toISOString())
        : item?.toISOString(),
    ]),
  ) as ProviderFilterValue;
}

function serializeStringComparisons(
  value: Record<string, Comparison | undefined> | undefined,
): Record<string, ProviderFilterValue> | undefined {
  if (!value) return undefined;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, ProviderFilterValue] => entry[1] !== undefined,
    ),
  );
}

function unsupportedProviderOperation(
  provider: Pick<BackendClientProvider, 'name'>,
  operation: string,
) {
  return new Error(
    `Provider "${provider.name}" does not support ${operation}.`,
  );
}

function mapSignedReadAccess(
  signedReadUrl:
    | Awaited<
        ReturnType<BackendClientProvider['backend']['upload']>
      >['signedReadUrl']
    | undefined,
) {
  if (!signedReadUrl) {
    return {};
  }
  return {
    ...signedReadUrl,
    expiresAt: new Date(signedReadUrl.expiresAt),
  };
}

function mapFileRecord(file: ProviderFile, baseUrl?: string) {
  return {
    ...file,
    url: getUrl(file.url, baseUrl),
    uploadedAt: new Date(file.uploadedAt),
    updatedAt: new Date(file.updatedAt),
  };
}

function mapMutationResult(
  result: ProviderFileMutationResult,
): FileMutationResult {
  const succeeded: FileReference[] = [];
  const failed: FileMutationFailure[] = [];
  for (const item of result.results) {
    if (item.success) succeeded.push(item.fileRef);
    else failed.push({ ref: item.fileRef, error: item.error });
  }
  return { succeeded, failed };
}

function requireMutationSuccess(
  result: ProviderFileMutationResult,
): FileMutationSuccess {
  const item = result.results[0];
  if (!item) {
    throw new Error('The provider returned no file mutation result.');
  }
  if (!item.success) {
    throw new EdgeStoreFileMutationError(
      item.error.code,
      item.error.message,
      item.fileRef,
    );
  }
  return { ref: item.fileRef };
}

export type InferClientResponse<TRouter extends AnyRouter> = {
  [TBucketName in keyof TRouter['buckets']]: {
    [TClienFn in keyof EdgeStoreClient<TRouter>[TBucketName]]: Simplify<
      Awaited<
        ReturnType<
          EdgeStoreClient<TRouter>[TBucketName][TClienFn] extends (
            ...args: any
          ) => any
            ? EdgeStoreClient<TRouter>[TBucketName][TClienFn]
            : never
        >
      >
    >;
  };
};
