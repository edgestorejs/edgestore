import { initEdgeStoreSdk } from '../../core/sdk';
import EdgeStoreCredentialsError from '../../libs/errors/EdgeStoreCredentialsError';
import { Provider } from '../types';

const DEFAULT_BASE_URL =
  process.env.EDGE_STORE_BASE_URL ?? 'https://files.edge-store.com';

export type EdgeStoreProviderOptions = {
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
};

export function EdgeStoreProvider(
  options?: EdgeStoreProviderOptions,
): Provider {
  const {
    accessKey = process.env.EDGE_STORE_ACCESS_KEY,
    secretKey = process.env.EDGE_STORE_SECRET_KEY,
    baseUrl = process.env.EDGE_STORE_BASE_URL ?? DEFAULT_BASE_URL,
  } = options ?? {};

  if (!accessKey || !secretKey) {
    throw new EdgeStoreCredentialsError();
  }

  const edgeStoreSdk = initEdgeStoreSdk({
    accessKey,
    secretKey,
  });
  return {
    init: async ({ ctx, router }) => {
      const token = await edgeStoreSdk.getToken({
        ctx,
        router,
      });
      return {
        token,
      };
    },
    getBaseUrl() {
      return baseUrl;
    },
    getFile: async ({ url }) => {
      const { uploadedAt, ...rest } = await edgeStoreSdk.getFile({
        url,
      });
      return {
        uploadedAt: new Date(uploadedAt),
        ...rest,
      };
    },
    requestUpload: async ({ bucketName, bucketType, fileInfo }) => {
      return await edgeStoreSdk.requestUpload({
        bucketName,
        bucketType,
        fileInfo,
      });
    },
    deleteFile: async ({ url }) => {
      return await edgeStoreSdk.deleteFile({
        url,
      });
    },
  };
}
