import {
  EdgeStoreError,
  type AnyContext,
  type AnyMetadata,
  type AnyRouter,
} from '@edgestore/shared';
import EdgeStoreCredentialsError from '../../libs/errors/EdgeStoreCredentialsError';

const API_ENDPOINT =
  process.env.EDGE_STORE_API_ENDPOINT ?? 'https://api.edgestore.dev';

type FileInfoForUpload = {
  size: number;
  extension: string;
  type?: string;
  isPublic: boolean;
  path: {
    key: string;
    value: string;
  }[];
  metadata: AnyMetadata;
  fileName?: string;
  replaceTargetUrl?: string;
  temporary: boolean;
};

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
  | Partial<
      {
        [K in SimpleOperator]: TType;
      } & {
        between: [TType, TType];
      }
    >;

type ListFilesFilter = {
  AND?: ListFilesFilter[];
  OR?: ListFilesFilter[];
  uploadedAt?: Comparison<Date>;
  path?: Partial<{
    [key: string]: Comparison;
  }>;
  metadata?: Partial<{
    [key: string]: Comparison;
  }>;
};

type Pagination = {
  currentPage: number;
  pageSize: number;
};

async function makeRequest<TOutput>(params: {
  body: object;
  accessKey: string;
  secretKey: string;
  path: string;
}) {
  const { body, accessKey, secretKey, path } = params;
  const res = await fetch(`${API_ENDPOINT}${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${accessKey}:${secretKey}`).toString(
        'base64',
      )}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to make request to ${path}: ${await res.text()}`);
  }
  return (await res.json()) as TOutput;
}

export const edgeStoreRawSdk = {
  async getToken(params: {
    accessKey: string;
    secretKey: string;
    ctx: AnyContext;
    router: AnyRouter;
  }) {
    const reqBuckets = Object.entries(params.router.buckets).reduce(
      (acc, [bucketName, bucket]) => {
        acc[bucketName] = {
          path: bucket._def.path.map((p: { [key: string]: () => string }) => {
            const paramEntries = Object.entries(p);
            if (paramEntries[0] === undefined) {
              throw new EdgeStoreError({
                message: `Empty path param found in: ${JSON.stringify(
                  bucket._def.path,
                )}`,
                code: 'SERVER_ERROR',
              });
            }
            const [key, value] = paramEntries[0];
            return {
              key,
              value: value(),
            };
          }),
          accessControl: bucket._def.accessControl,
        };
        return acc;
      },
      {} as any,
    );
    const { token } = await makeRequest<{ token: string }>({
      body: {
        ctx: params.ctx,
        buckets: reqBuckets,
      },
      accessKey: params.accessKey,
      secretKey: params.secretKey,
      path: '/get-token',
    });
    return token;
  },

  async getFile({
    accessKey,
    secretKey,
    url,
  }: {
    accessKey: string;
    secretKey: string;
    url: string;
  }) {
    return await makeRequest<{
      url: string;
      size: number;
      uploadedAt: string;
      path: Record<string, string>;
      metadata: Record<string, string>;
    }>({
      path: '/get-file',
      accessKey,
      secretKey,
      body: {
        url,
      },
    });
  },

  async requestUpload({
    accessKey,
    secretKey,
    bucketName,
    bucketType,
    fileInfo,
    multipart,
  }: {
    accessKey: string;
    secretKey: string;
    bucketName: string;
    bucketType: string;
    fileInfo: FileInfoForUpload;
    multipart?: {
      parts: number[];
    };
  }) {
    const res = await makeRequest<{
      multipart?: {
        key: string;
        uploadId: string;
        parts: {
          partNumber: number;
          signedUrl: string;
        }[];
      };
      signedUrl?: string;
      url: string;
      path: string;
      thumbnailUrl: string | null;
    }>({
      path: '/request-upload',
      accessKey,
      secretKey,
      body: {
        multipart,
        bucketName,
        bucketType,
        isPublic: fileInfo.isPublic,
        path: fileInfo.path,
        extension: fileInfo.extension,
        size: fileInfo.size,
        mimeType: fileInfo.type,
        metadata: fileInfo.metadata,
        fileName: fileInfo.fileName,
        replaceTargetUrl: fileInfo.replaceTargetUrl,
        isTemporary: fileInfo.temporary,
      },
    });
    return {
      multipart: res.multipart,
      signedUrl: res.signedUrl,
      accessUrl: res.url,
      path: res.path,
      thumbnailUrl: res.thumbnailUrl,
    };
  },

  async requestUploadParts({
    accessKey,
    secretKey,
    key,
    multipart,
  }: {
    accessKey: string;
    secretKey: string;
    key: string;
    multipart: {
      uploadId?: string;
      parts: number[];
    };
  }) {
    const res = await makeRequest<{
      multipart: {
        uploadId: string;
        parts: {
          partNumber: number;
          signedUrl: string;
        }[];
      };
    }>({
      path: '/request-upload-parts',
      accessKey,
      secretKey,
      body: {
        multipart,
        key,
      },
    });
    return {
      multipart: res.multipart,
    };
  },

  async completeMultipartUpload({
    accessKey,
    secretKey,
    uploadId,
    key,
    parts,
  }: {
    accessKey: string;
    secretKey: string;
    uploadId: string;
    key: string;
    parts: {
      partNumber: number;
      eTag: string;
    }[];
  }) {
    return await makeRequest<{ success: boolean }>({
      path: '/complete-multipart-upload',
      accessKey,
      secretKey,
      body: {
        uploadId,
        key,
        parts,
      },
    });
  },

  async confirmUpload({
    accessKey,
    secretKey,
    url,
  }: {
    accessKey: string;
    secretKey: string;
    url: string;
  }) {
    return await makeRequest<{ success: boolean }>({
      path: '/confirm-upload',
      accessKey,
      secretKey,
      body: {
        url,
      },
    });
  },

  async deleteFile({
    accessKey,
    secretKey,
    url,
  }: {
    accessKey: string;
    secretKey: string;
    url: string;
  }) {
    return await makeRequest<{ success: boolean }>({
      path: '/delete-file',
      accessKey,
      secretKey,
      body: {
        url,
      },
    });
  },

  async listFiles({
    accessKey,
    secretKey,
    bucketName,
    filter,
    pagination,
  }: {
    accessKey: string;
    secretKey: string;
    bucketName: string;
    filter?: ListFilesFilter;
    pagination?: Pagination;
  }) {
    return await makeRequest<{
      data: {
        url: string;
        thumbnailUrl: string | null;
        size: number;
        uploadedAt: string;
        path: Record<string, string>;
        metadata: Record<string, string>;
      }[];
      pagination: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        totalCount: number;
      };
    }>({
      path: '/list-files',
      accessKey,
      secretKey,
      body: {
        bucketName,
        filter,
        pagination,
      },
    });
  },
};

export function initEdgeStoreSdk(params: {
  accessKey?: string;
  secretKey?: string;
}) {
  const {
    accessKey = process.env.EDGE_STORE_ACCESS_KEY,
    secretKey = process.env.EDGE_STORE_SECRET_KEY,
  } = params ?? {};

  if (!accessKey || !secretKey) {
    throw new EdgeStoreCredentialsError();
  }

  return {
    async getToken(params: { ctx: AnyContext; router: AnyRouter }) {
      return await edgeStoreRawSdk.getToken({
        accessKey,
        secretKey,
        ctx: params.ctx,
        router: params.router,
      });
    },
    async getFile({ url }: { url: string }) {
      return await edgeStoreRawSdk.getFile({
        accessKey,
        secretKey,
        url,
      });
    },
    async requestUpload({
      bucketName,
      bucketType,
      fileInfo,
      multipart,
    }: {
      bucketName: string;
      bucketType: string;
      fileInfo: FileInfoForUpload;
      multipart?: {
        parts: number[];
      };
    }) {
      return await edgeStoreRawSdk.requestUpload({
        accessKey,
        secretKey,
        bucketName,
        bucketType,
        fileInfo,
        multipart,
      });
    },
    async requestUploadParts({
      key,
      multipart,
    }: {
      key: string;
      multipart: {
        uploadId?: string;
        parts: number[];
      };
    }) {
      return await edgeStoreRawSdk.requestUploadParts({
        accessKey,
        secretKey,
        key,
        multipart,
      });
    },
    async completeMultipartUpload({
      uploadId,
      key,
      parts,
    }: {
      uploadId: string;
      key: string;
      parts: {
        partNumber: number;
        eTag: string;
      }[];
    }) {
      return await edgeStoreRawSdk.completeMultipartUpload({
        accessKey,
        secretKey,
        uploadId,
        key,
        parts,
      });
    },
    async confirmUpload({ url }: { url: string }) {
      return await edgeStoreRawSdk.confirmUpload({
        accessKey,
        secretKey,
        url,
      });
    },
    async deleteFile({ url }: { url: string }) {
      return await edgeStoreRawSdk.deleteFile({
        accessKey,
        secretKey,
        url,
      });
    },
    async listFiles(params: {
      bucketName: string;
      filter?: ListFilesFilter;
      pagination?: Pagination;
    }) {
      return await edgeStoreRawSdk.listFiles({
        accessKey,
        secretKey,
        ...params,
      });
    },
  };
}

export type EdgeStoreSdk = ReturnType<typeof initEdgeStoreSdk>;
