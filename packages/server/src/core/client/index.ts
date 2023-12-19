/* eslint-disable @typescript-eslint/ban-types */
import {
  type AnyBuilder,
  type AnyRouter,
  type InferBucketPathKeys,
  type InferBucketPathObject,
  type InferMetadataObject,
  type Prettify,
  type Simplify,
} from '@edgestore/shared';
import { type z, type ZodNever } from 'zod';
import { type Comparison } from '..';
import { buildPath, parsePath } from '../../adapters/shared';
import { initEdgeStoreSdk } from '../sdk';

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
   * If you want to replace an existing file immediately leave the `manualFileName` option empty and use the `replaceTargetUrl` option.
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
  content: TextContent | BlobContent | UrlContent;
  options?: UploadOptions;
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

export type UploadFileRes<TBucket extends AnyBuilder> = {
  url: string;
  size: number;
  metadata: InferMetadataObject<TBucket>;
  path: InferBucketPathObject<TBucket>;
  pathOrder: (keyof InferBucketPathObject<TBucket>)[];
};

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
    currentPage: number;
    pageSize: number;
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
    currentPage: number;
    totalPages: number;
    totalCount: number;
  };
};

type EdgeStoreClient<TRouter extends AnyRouter> = {
  [K in keyof TRouter['buckets']]: {
    getFile: (params: {
      url: string;
    }) => Promise<GetFileRes<TRouter['buckets'][K]>>;

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
      params: UploadFileRequest<TRouter['buckets'][K]>,
    ) => Promise<Prettify<UploadFileRes<TRouter['buckets'][K]>>>;
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
      params?: ListFilesRequest<TRouter['buckets'][K]>,
    ) => Promise<Prettify<ListFilesResponse<TRouter['buckets'][K]>>>;
  };
};

export function initEdgeStoreClient<TRouter extends AnyRouter>(config: {
  router: TRouter;
  accessKey?: string;
  secretKey?: string;
  /**
   * The base URL of your application.
   *
   * This is only needed for getting protected files on a development environment.
   *
   * @example http://localhost:3000/api/edgestore
   */
  baseUrl?: string;
}) {
  const sdk = initEdgeStoreSdk({
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
  return new Proxy<EdgeStoreClient<TRouter>>({} as any, {
    get(_target, key) {
      const bucketName = key as string;
      const bucket = config.router.buckets[bucketName];
      if (!bucket) {
        throw new Error(`Bucket ${bucketName} not found`);
      }
      const client: EdgeStoreClient<TRouter>[string] = {
        async upload(params) {
          const content = params.content;
          const ctx = 'ctx' in params ? params.ctx : {};
          const input = 'input' in params ? params.input : {};

          const { blob, extension } = await (async () => {
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

          const path = buildPath({
            bucket,
            pathAttrs: {
              ctx,
              input,
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
            input,
          });

          const requestUploadRes = await sdk.requestUpload({
            bucketName,
            bucketType: bucket._def.type,
            fileInfo: {
              fileName: params.options?.manualFileName,
              replaceTargetUrl: params.options?.replaceTargetUrl,
              type: blob.type,
              size: blob.size,
              extension,
              isPublic: bucket._def.accessControl === undefined,
              temporary: params.options?.temporary ?? false,
              path,
              metadata,
            },
          });

          const { signedUrl, multipart } = requestUploadRes;

          if (multipart) {
            // TODO
            throw new Error('Multipart upload not implemented');
          } else if (signedUrl) {
            await fetch(signedUrl, {
              method: 'PUT',
              body: blob,
            });
          } else {
            throw new Error('Missing signedUrl');
          }
          const { parsedPath, pathOrder } = parsePath(path);
          return {
            url: requestUploadRes.accessUrl,
            size: blob.size,
            metadata,
            path: parsedPath,
            pathOrder,
          } satisfies UploadFileRes<typeof bucket> as UploadFileRes<
            TRouter['buckets'][string]
          >;
        },

        async getFile(params) {
          const res = await sdk.getFile(params);
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
          return await sdk.confirmUpload(params);
        },

        async deleteFile(params) {
          return await sdk.deleteFile(params);
        },

        async listFiles(params) {
          const res = await sdk.listFiles({
            bucketName,
            ...params,
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
      };
      return client;
    },
  });
}

/**
 * Protected files need third-party cookies to work.
 * Since third party cookies doesn't work on localhost,
 * we need to proxy the file through the server.
 */
function getUrl(url: string, baseUrl?: string) {
  if (process.env.NODE_ENV === 'development' && !url.includes('/_public/')) {
    if (!baseUrl) {
      throw new Error(
        'Missing baseUrl. You need to pass the baseUrl to `initEdgeStoreClient` to get protected files in development.',
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
  return await res.blob();
}

export type InferClientResponse<TRouter extends AnyRouter> = {
  [TBucketName in keyof TRouter['buckets']]: {
    [TClienFn in keyof EdgeStoreClient<TRouter>[TBucketName]]: Simplify<
      Awaited<ReturnType<EdgeStoreClient<TRouter>[TBucketName][TClienFn]>>
    >;
  };
};
