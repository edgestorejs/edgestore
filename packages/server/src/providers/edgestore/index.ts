import {
  EdgeStoreError,
  type Provider,
  type RequestUploadRes,
} from '@edgestore/shared';
import { initEdgeStoreSdk } from '../../core/sdk';
import EdgeStoreCredentialsError from '../../libs/errors/EdgeStoreCredentialsError';

const DEFAULT_BASE_URL = 'https://files.edgestore.dev';

export type EdgeStoreProviderOptions = {
  /**
   * Access key for your EdgeStore project.
   * Can be found in the EdgeStore dashboard.
   *
   * This can be omitted if the `EDGE_STORE_ACCESS_KEY` environment variable is set.
   */
  accessKey?: string;
  /**
   * Secret key for your EdgeStore project.
   * Can be found in the EdgeStore dashboard.
   *
   * This can be omitted if the `EDGE_STORE_SECRET_KEY` environment variable is set.
   */
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
      // multipart upload if file is bigger than a certain size
      const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB
      let partSize = 5 * 1024 * 1024; // 5MB
      if (fileInfo.size > MULTIPART_THRESHOLD) {
        let totalParts = Math.ceil(fileInfo.size / partSize);
        if (totalParts > 1000) {
          // the maximum number of parts is 1000
          totalParts = 1000;
          partSize = Math.ceil(fileInfo.size / totalParts);
        }
        const res = await edgeStoreSdk.requestUpload({
          bucketName,
          bucketType,
          fileInfo,
          multipart: {
            parts: Array.from({ length: totalParts }).map(
              (_, index) => index + 1,
            ),
          },
        });
        const multipart = res.multipart
          ? {
              key: res.multipart.key,
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
            thumbnailUrl: res.thumbnailUrl,
            multipart,
          };
        } else if (res.signedUrl) {
          return {
            accessUrl: res.accessUrl,
            uploadUrl: res.signedUrl,
            thumbnailUrl: res.thumbnailUrl,
          };
        } else {
          throw new EdgeStoreError({
            message: 'Could not get upload url',
            code: 'SERVER_ERROR',
          });
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
          thumbnailUrl: res.thumbnailUrl,
        };
      }
      throw new EdgeStoreError({
        message: 'Could not get upload url',
        code: 'SERVER_ERROR',
      });
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
    completeMultipartUpload: async ({ uploadId, key, parts }) => {
      return await edgeStoreSdk.completeMultipartUpload({
        uploadId,
        key,
        parts,
      });
    },
    confirmUpload: async ({ url }) => {
      return await edgeStoreSdk.confirmUpload({
        url,
      });
    },
    deleteFile: async ({ url }) => {
      return await edgeStoreSdk.deleteFile({
        url,
      });
    },
  };
}
