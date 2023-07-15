import { AnyEdgeStoreRouter } from '..';
import { AnyBuilder } from '../internals/bucketBuilder';

const API_ENDPOINT =
  process.env.EDGE_STORE_API_ENDPOINT ?? 'https://api.edge-store.com';

type FileInfoForUpload = {
  routeName: string;
  size: number;
  extension: string;
  isPublic: boolean;
  path: {
    key: string;
    value: string;
  }[];
  metadata?: {
    [key: string]: string;
  };
  replaceTargetUrl?: string;
};

type SimpleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'startsWith'
  | 'endsWith';

type FilterOperator =
  | string
  | Record<string, SimpleOperator>
  | Record<'between', [string, string]>;

type ListFilesFilter = {
  uploadedAt?: FilterOperator;
  path?: Record<string, SimpleOperator>;
  metadata?: Record<string, SimpleOperator>;
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
    throw new Error(`Failed to make request to ${path}`);
  }
  return (await res.json()) as TOutput;
}

export const edgeStoreRawSdk = {
  async getToken(params: {
    accessKey: string;
    secretKey: string;
    ctx: any;
    router: AnyEdgeStoreRouter;
  }) {
    const reqRoutes = Object.entries(params.router.routes).reduce(
      (acc, [routeName, route]) => {
        acc[routeName] = {
          path: route._def.path.map((p: { [key: string]: () => string }) => {
            const paramEntries = Object.entries(p);
            if (paramEntries[0] === undefined) {
              throw new Error('Missing path param');
            }
            const [key, value] = paramEntries[0];
            return {
              key,
              value: value(),
            };
          }),
          accessControl: route._def.accessControl,
        };
        return acc;
      },
      {} as any,
    );
    const { token } = await makeRequest<{ token: string }>({
      body: {
        ctx: params.ctx,
        routes: reqRoutes,
      },
      accessKey: params.accessKey,
      secretKey: params.secretKey,
      path: '/get-token',
    });
    return token;
  },

  async requestUpload({
    accessKey,
    secretKey,
    route,
    fileInfo,
  }: {
    accessKey: string;
    secretKey: string;
    route: AnyBuilder;
    fileInfo: FileInfoForUpload;
  }) {
    const res = await makeRequest<{
      signedUrl: string;
      url: string;
    }>({
      path: '/request-upload',
      accessKey,
      secretKey,
      body: {
        bucketName: fileInfo.routeName,
        bucketType: route._def.type,
        isPublic: fileInfo.isPublic,
        path: fileInfo.path,
        extension: fileInfo.extension,
        size: fileInfo.size,
        metadata: fileInfo.metadata,
        replaceTargetUrl: fileInfo.replaceTargetUrl,
      },
    });
    return {
      uploadUrl: res.signedUrl,
      accessUrl: res.url,
    };
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

export function initEdgeStoreSdk<TCtx>(params?: {
  accessKey?: string;
  secretKey?: string;
}) {
  const {
    accessKey = process.env.EDGE_STORE_ACCESS_KEY,
    secretKey = process.env.EDGE_STORE_SECRET_KEY,
  } = params ?? {};

  if (!accessKey || !secretKey) {
    throw new Error('Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY');
  }

  return {
    async getToken(params: { ctx: TCtx; router: AnyEdgeStoreRouter }) {
      return await edgeStoreRawSdk.getToken({
        accessKey,
        secretKey,
        ctx: params.ctx,
        router: params.router,
      });
    },
    async requestUpload({
      route,
      fileInfo,
    }: {
      route: AnyBuilder;
      fileInfo: FileInfoForUpload;
    }) {
      return await edgeStoreRawSdk.requestUpload({
        accessKey,
        secretKey,
        route,
        fileInfo,
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
