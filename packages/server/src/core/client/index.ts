/* eslint-disable @typescript-eslint/ban-types */
import {
  type AnyBuilder,
  type AnyRouter,
  type InferBucketPathKeys,
  type InferBucketPathObject,
  type InferBucketPathOrder,
  type InferMetadataObject,
  type MaybePromise,
  type Prettify,
  type Provider,
  type ProviderFilterValue,
  type ListFilesFilter as ProviderListFilesFilter,
  type RequestUploadRes,
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

export type GetFileRes<TBucket extends AnyBuilder> = {
  url: string;
  size: number;
  uploadedAt: Date;
  metadata: InferMetadataObject<TBucket>;
  path: InferBucketPathObject<TBucket>;
};

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

export type UploadFileRes<TBucket extends AnyBuilder> =
  (TBucket['_def']['type'] extends 'IMAGE'
    ? {
        url: string;
        thumbnailUrl: string | null;
        size: number;
        metadata: InferMetadataObject<TBucket>;
        path: InferBucketPathObject<TBucket>;
        pathOrder: InferBucketPathOrder<TBucket>;
      }
    : {
        url: string;
        size: number;
        metadata: InferMetadataObject<TBucket>;
        path: InferBucketPathObject<TBucket>;
        pathOrder: InferBucketPathOrder<TBucket>;
      }) &
    (undefined extends TBucket['_def']['autoSignedUrls']
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
  pagination?: {
    cursor?: string;
    limit?: number;
  };
};

export type ListFilesResponse<TBucket extends AnyBuilder> = {
  data: TBucket['_def']['type'] extends 'IMAGE'
    ? {
        url: string;
        thumbnailUrl: string | null;
        size: number;
        uploadedAt: Date;
        metadata: InferMetadataObject<TBucket>;
        path: InferBucketPathObject<TBucket>;
      }[]
    : {
        url: string;
        size: number;
        uploadedAt: Date;
        metadata: InferMetadataObject<TBucket>;
        path: InferBucketPathObject<TBucket>;
      }[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

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
  getFile: (params: { url: string }) => Promise<Prettify<GetFileRes<TBucket>>>;

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
  confirmUpload: (params: { url: string }) => Promise<{ success: boolean }>;
  /**
   * Programmatically delete a file directly from your backend.
   */
  deleteFile: (params: { url: string }) => Promise<{
    success: boolean;
  }>;
  /**
   * List files in a bucket.
   *
   * You can also filter the results by passing a filter object.
   * The results are paginated.
   */
  listFiles: (
    params?: ListFilesRequest<TBucket>,
  ) => Promise<Prettify<ListFilesResponse<TBucket>>>;
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
  provider?: Provider;
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
  return new Proxy<EdgeStoreClient<TRouter>>({} as any, {
    get(_target, key) {
      const bucketName = key as string;
      const bucket = config.router.buckets[bucketName];
      if (!bucket) {
        throw new Error(`Bucket ${bucketName} not found`);
      }
      const client: EdgeStoreClient<TRouter>[string] = {
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
                blob: await getBlobFromUrl(content.url),
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

          const requestUploadRes = await provider.requestUpload({
            bucketName,
            bucketType: bucket._def.type,
            autoSignedUrls: bucket._def.autoSignedUrls,
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

          if ('multipart' in requestUploadRes) {
            await uploadMultipart({
              blob,
              multipart: requestUploadRes.multipart,
              provider,
              signal: params.signal,
              onProgress: params.onProgress,
            });
          } else if ('uploadUrl' in requestUploadRes) {
            await uploadPart({
              url: requestUploadRes.uploadUrl,
              body: blob,
              signal: params.signal,
            });
            params.onProgress?.({
              transferredBytes: blob.size,
              totalBytes: blob.size,
              percentage: 100,
            });
          } else {
            throw new Error('Missing upload URL');
          }
          const { parsedPath, pathOrder } = parsePath(path);
          return {
            url: requestUploadRes.accessUrl,
            ...{
              thumbnailUrl: requestUploadRes.thumbnailUrl,
            },
            ...mapSignedUploadAccess(requestUploadRes),
            size: blob.size,
            metadata: normalizedMetadata,
            path: parsedPath,
            pathOrder,
          } as unknown as UploadFileRes<TRouter['buckets'][string]>;
        },

        async getFile(params) {
          const res = await provider.getFile(params);
          return {
            url: getUrl(res.url, config.baseUrl),
            size: res.size,
            uploadedAt: new Date(res.uploadedAt),
            metadata: res.metadata,
            path: res.path as any,
          } satisfies GetFileRes<typeof bucket> as GetFileRes<
            TRouter['buckets'][string]
          >;
        },

        async confirmUpload(params) {
          return await provider.confirmUpload({ bucket, ...params });
        },

        async deleteFile(params) {
          return await provider.deleteFile({ bucket, ...params });
        },

        async listFiles(params) {
          if (!provider.listFiles) {
            throw unsupportedProviderOperation(provider, 'listFiles');
          }
          const res = await provider.listFiles({
            bucketName,
            filter: serializeFilter(params?.filter),
            pagination: params?.pagination,
          });

          const files = res.data.map((file) => {
            return {
              url: getUrl(file.url, config.baseUrl),
              thumbnailUrl: file.thumbnailUrl,
              size: file.size,
              uploadedAt: new Date(file.uploadedAt),
              metadata: file.metadata,
              path: file.path as any,
            };
          }) satisfies ListFilesResponse<
            typeof bucket
          >['data'] as ListFilesResponse<TRouter['buckets'][string]>['data'];

          return {
            data: files,
            pagination: res.pagination,
          };
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
      return client;
    },
  });
}

/** @deprecated Use `createEdgeStoreClient()` instead. */
export const initEdgeStoreClient = createEdgeStoreClient;

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

async function getBlobFromUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not fetch upload source: HTTP ${res.status}`);
  }
  return await res.blob();
}

async function uploadPart(params: {
  url: string;
  body: Blob;
  signal?: AbortSignal;
}) {
  const response = await fetch(params.url, {
    method: 'PUT',
    body: params.body,
    signal: params.signal,
  });
  if (!response.ok) {
    throw new Error(
      `Upload failed with status ${response.status}: ${response.statusText}`,
    );
  }
  return response.headers?.get('etag') ?? null;
}

async function uploadMultipart(params: {
  blob: Blob;
  multipart: Extract<RequestUploadRes, { multipart: unknown }>['multipart'];
  provider: Provider;
  signal?: AbortSignal;
  onProgress?: UploadFileRequest<AnyBuilder>['onProgress'];
}) {
  const { blob, multipart, provider, signal, onProgress } = params;
  const completed = new Array<{ partNumber: number; eTag: string }>();
  let nextIndex = 0;
  let transferredBytes = 0;

  const worker = async () => {
    while (nextIndex < multipart.parts.length) {
      const part = multipart.parts[nextIndex++];
      if (!part) return;
      const chunk = blob.slice(
        (part.partNumber - 1) * multipart.partSize,
        part.partNumber * multipart.partSize,
      );
      const eTag = await uploadPart({
        url: part.uploadUrl,
        body: chunk,
        signal,
      });
      if (!eTag) {
        throw new Error('Could not get ETag from multipart response');
      }
      completed.push({ partNumber: part.partNumber, eTag });
      transferredBytes += chunk.size;
      onProgress?.({
        transferredBytes,
        totalBytes: blob.size,
        percentage: Math.round((transferredBytes / blob.size) * 10_000) / 100,
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(4, multipart.parts.length) }, worker),
  );
  completed.sort((a, b) => a.partNumber - b.partNumber);
  await provider.completeMultipartUpload({
    uploadId: multipart.uploadId,
    key: multipart.key,
    parts: completed,
  });
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

function unsupportedProviderOperation(provider: Provider, operation: string) {
  return new Error(
    `Provider "${provider.name}" does not support ${operation}.`,
  );
}

function mapSignedUploadAccess(res: {
  accessSignedUrl?: string;
  accessSignedThumbnailUrl?: string | null;
  accessSignedUrlExpiresAt?: Date | string;
  accessSignedUrlExpiresIn?: number;
}) {
  if (!res.accessSignedUrl) {
    return {};
  }
  return {
    signedUrl: res.accessSignedUrl,
    expiresAt: res.accessSignedUrlExpiresAt
      ? new Date(res.accessSignedUrlExpiresAt)
      : new Date(),
    expiresIn: res.accessSignedUrlExpiresIn ?? 0,
    signedThumbnailUrl: res.accessSignedThumbnailUrl ?? null,
  };
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
