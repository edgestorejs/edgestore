import { initEdgeStoreSdk } from '../../core/sdk';
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
    throw new Error('Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY');
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
    requestUpload: async ({ route, fileInfo }) => {
      return await edgeStoreSdk.requestUpload({
        route,
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
