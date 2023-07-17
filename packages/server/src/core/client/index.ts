import { AnyRouter } from '..';
import { Simplify } from '../../types';
import {
  InferBucketPathKeys,
  InferMetadataObject,
} from '../internals/bucketBuilder';
import { EdgeStoreSdk, initEdgeStoreSdk } from '../sdk';

export type GetFileRes<TBucket extends AnyRouter['buckets'][string]> = {
  url: string;
  size: number;
  uploadedAt: Date;
  metadata: InferMetadataObject<TBucket>;
  path: {
    [TKey in InferBucketPathKeys<TBucket>]: string;
  };
};

export type ListFilesResponse<TBucket extends AnyRouter['buckets'][string]> = {
  data: {
    url: string;
    thumbnailUrl: TBucket['_def']['type'] extends 'IMAGE'
      ? string | null
      : never;
    size: number;
    uploadedAt: Date;
    metadata: InferMetadataObject<TBucket>;
    path: {
      [TKey in InferBucketPathKeys<TBucket>]: string;
    };
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
    // TODO: replace with upload
    requestUpload: (params: {
      file: File;
      path: {
        [TKey in InferBucketPathKeys<TRouter['buckets'][K]>]: string;
      };
      metadata: InferMetadataObject<TRouter['buckets'][K]>;
      replaceTargetUrl?: string;
    }) => Promise<{
      uploadUrl: string;
      accessUrl: string;
    }>;
    /**
     * Programmatically delete a file.
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
      params?: Simplify<
        Omit<Parameters<EdgeStoreSdk['listFiles']>[0], 'bucketName'>
      >,
    ) => Promise<ListFilesResponse<TRouter['buckets'][K]>>;
  };
};

export function initEdgeStoreClient<TRouter extends AnyRouter>(config: {
  router: TRouter;
  accessKey?: string;
  secretKey?: string;
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
        async getFile(params) {
          const res = await sdk.getFile(params);
          return {
            url: res.url,
            size: res.size,
            uploadedAt: new Date(res.uploadedAt),
            metadata: res.metadata,
            path: res.path as any,
          } satisfies GetFileRes<typeof bucket> as GetFileRes<
            TRouter['buckets'][string]
          >;
        },
        async requestUpload(params) {
          const { file, path, metadata, replaceTargetUrl } = params;
          const fileExtension = file.name.includes('.')
            ? file.name.split('.').pop()
            : undefined;
          if (!fileExtension) {
            throw new Error('Missing file extension');
          }
          const parsedPath = Object.keys(bucket._def.path).map((key) => {
            const value = path[key as keyof typeof path];
            if (value === undefined) {
              throw new Error(`Missing path param ${key}`);
            }
            return {
              key,
              value,
            };
          });

          const fileInfo = {
            size: file.size,
            extension: fileExtension,
            isPublic: bucket._def.accessControl === undefined,
            path: parsedPath,
            metadata,
            replaceTargetUrl,
          };

          return await sdk.requestUpload({
            bucketName,
            bucketType: bucket._def.type,
            fileInfo,
          });
        },

        async deleteFile(params) {
          return await sdk.deleteFile({
            ...params,
          });
        },

        async listFiles(params) {
          const res = await sdk.listFiles({
            bucketName,
            ...params,
          });

          const files = res.data.map((file) => {
            return {
              url: file.url,
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

export type InferClientResponse<TRouter extends AnyRouter> = {
  [TBucketName in keyof TRouter['buckets']]: {
    [TClienFn in keyof EdgeStoreClient<TRouter>[TBucketName]]: Simplify<
      Awaited<ReturnType<EdgeStoreClient<TRouter>[TBucketName][TClienFn]>>
    >;
  };
};
