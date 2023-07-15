import { AnyEdgeStoreRouter } from '..';
import { Simplify } from '../../types';
import { initEdgeStoreSdk } from '../sdk';

type EdgeStoreClient<TRouter extends AnyEdgeStoreRouter> = {
  [K in keyof TRouter['routes']]: {
    getToken: (params: {
      ctx: TRouter['routes'][K]['$config']['ctx'];
    }) => Promise<unknown>;
    listFiles: (params: { bucketName: string }) => Promise<unknown>;
  };
};

type InferClientParams<TType extends (...args: any) => any> = Simplify<
  Omit<Parameters<TType>[0], 'bucketName' | 'route'>
>;

export function initEdgeStoreClient<
  TRouter extends AnyEdgeStoreRouter,
>(config: { router: TRouter; accessKey?: string; secretKey?: string }) {
  const sdk = initEdgeStoreSdk({
    accessKey: config.accessKey,
    secretKey: config.secretKey,
  });
  return new Proxy<EdgeStoreClient<TRouter>>({} as any, {
    get(_target, key) {
      const bucketName = key as string;
      const route = config.router.routes[bucketName];
      if (!route) {
        throw new Error(`Route ${bucketName} not found`);
      }
      return {
        async requestUpload(
          params: InferClientParams<typeof sdk.requestUpload>,
        ) {
          return await sdk.requestUpload({
            route,
            ...params,
          });
        },

        async deleteFile(params: InferClientParams<typeof sdk.deleteFile>) {
          return await sdk.deleteFile({
            ...params,
          });
        },

        async listFiles(params: InferClientParams<typeof sdk.listFiles>) {
          return await sdk.listFiles({
            bucketName,
            ...params,
          });
        },
      };
    },
  });
}
