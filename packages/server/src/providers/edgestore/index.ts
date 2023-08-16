import { initEdgeStoreSdk } from '../../core/sdk';
import EdgeStoreCredentialsError from '../../libs/errors/EdgeStoreCredentialsError';
import { Provider, RequestUploadRes } from '../types';

const DEFAULT_BASE_URL = 'https://files.edgestore.dev';

export type EdgeStoreProviderOptions = {
  accessKey?: string;
  secretKey?: string;
};

export function EdgeStoreProvider(
  options?: EdgeStoreProviderOptions,
): Provider {
  const {
    accessKey = process.env.EDGE_STORE_ACCESS_KEY,
    secretKey = process.env.EDGE_STORE_SECRET_KEY,
  } = options ?? {};

  const baseUrl = process.env.EDGE_STORE_BASE_URL ?? DEFAULT_BASE_URL;

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
    async requestUpload({
      bucketName,
      bucketType,
      fileInfo,
    }): Promise<RequestUploadRes> {
      // multiplart upload if file is bigger than a certain size
      const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB
      const CONCURRENCY = 3;
      let partSize = 5 * 1024 * 1024; // 5MB
      if (fileInfo.size > MULTIPART_THRESHOLD) {
        let totalParts = Math.ceil(fileInfo.size / partSize);
        if (totalParts > 10000) {
          // the maximum number of parts is 10000
          totalParts = 10000;
          partSize = Math.ceil(fileInfo.size / totalParts);
        }
        const requestParts =
          totalParts > CONCURRENCY ? CONCURRENCY : totalParts;
        const res = await edgeStoreSdk.requestUpload({
          bucketName,
          bucketType,
          fileInfo,
          multipart: {
            parts: Array.from({ length: requestParts }).map(
              (_, index) => index + 1,
            ),
          },
        });
        const multipart = res.multipart
          ? {
              uploadId: res.multipart.uploadId,
              parts: res.multipart.parts.map((part) => ({
                partNumber: part.partNumber,
                uploadUrl: part.signedUrl,
              })),
              partSize,
              totalParts,
            }
          : undefined;
        if (multipart) {
          return {
            accessUrl: res.accessUrl,
            multipart,
          };
        } else if (res.signedUrl) {
          return {
            accessUrl: res.accessUrl,
            uploadUrl: res.signedUrl,
          };
        } else {
          throw new Error('Could not get upload url');
        }
      }
      const res = await edgeStoreSdk.requestUpload({
        bucketName,
        bucketType,
        fileInfo,
      });
      if (res.signedUrl) {
        return {
          accessUrl: res.accessUrl,
          uploadUrl: res.signedUrl,
        };
      }
      throw new Error('Could not get upload url');
    },
    requestUploadParts: async ({ multipart, path }) => {
      const res = await edgeStoreSdk.requestUploadParts({
        multipart,
        key: path,
      });
      return {
        multipart: {
          uploadId: res.multipart.uploadId,
          parts: res.multipart.parts.map((part) => ({
            partNumber: part.partNumber,
            uploadUrl: part.signedUrl,
          })),
        },
      };
    },
    deleteFile: async ({ url }) => {
      return await edgeStoreSdk.deleteFile({
        url,
      });
    },
  };
}
