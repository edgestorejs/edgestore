import {
  createEdgeStoreSdk,
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
} from '@edgestore/sdk';
import {
  EdgeStoreError,
  type BackendClientProvider,
  type Provider,
  type ProviderBackend,
  type ProviderFile,
  type RequestUploadRes,
} from '@edgestore/shared';
import { getEnv } from '../../adapters/shared';
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
  /** Override the API v2 base URL. */
  apiUrl?: string;
};

export function edgestore(
  options?: EdgeStoreProviderOptions,
): BackendClientProvider {
  const {
    accessKey = getEnv('EDGE_STORE_ACCESS_KEY') ??
      // @ts-expect-error - In Vite/Astro, the env variables are available on `import.meta`.
      import.meta.env?.EDGE_STORE_ACCESS_KEY,
    secretKey = getEnv('EDGE_STORE_SECRET_KEY') ??
      // @ts-expect-error - In Vite/Astro, the env variables are available on `import.meta`.
      import.meta.env?.EDGE_STORE_SECRET_KEY,
  } = options ?? {};

  const baseUrl = getEnv('EDGE_STORE_BASE_URL') ?? DEFAULT_BASE_URL;

  if (!accessKey || !secretKey) {
    throw new EdgeStoreCredentialsError();
  }

  const sdk = createEdgeStoreSdk({
    credentials: { accessKey, secretKey },
    baseUrl: options?.apiUrl ?? getApiUrl(),
  });

  const backend: ProviderBackend = {
    upload: async ({
      bucketName,
      bucketType,
      fileInfo,
      autoSignedUrls,
      source,
      signal,
      onProgress,
    }) => {
      const result = await sdk.runtime.uploads.upload({
        bucket: bucketName,
        source,
        ...mapUploadRequest(bucketType, fileInfo, autoSignedUrls),
        signal,
        onProgress,
      });
      return {
        file: mapFile(result.file),
        signedReadUrl: result.signedReadUrl
          ? {
              ...result.signedReadUrl,
              expiresAt: new Date(result.signedReadUrl.expiresAt),
            }
          : undefined,
      };
    },
    getFile: async ({ file: fileRef }) => {
      const { file } = await sdk.runtime.files.lookup({ file: fileRef });
      return mapFile(file);
    },
    listFiles: async ({ bucketName, filter, cursor, limit }) => {
      const { files, pagination } = await sdk.runtime.files.search({
        bucket: bucketName,
        filter,
        pagination: { cursor, limit },
      });
      return {
        items: files.map(mapFile),
        ...pagination,
      };
    },
    confirmFiles: async ({ files }) =>
      await sdk.runtime.files.confirmMany({ files }),
    deleteFiles: async ({ files }) =>
      await sdk.runtime.files.deleteMany({ files }),
    restoreFiles: async ({ files }) =>
      await sdk.runtime.files.restoreMany({ files }),
  };

  return {
    name: 'edgestore',
    init: async ({ ctx, router }) => {
      const { token } = await sdk.runtime.accessTokens.create({
        context: ctx as Record<string, string>,
        buckets: Object.fromEntries(
          Object.entries(router.buckets).map(([bucketName, bucket]) => [
            bucketName,
            {
              path: bucket._def.path.map((part) => {
                const entry = Object.entries(part)[0];
                if (!entry) {
                  throw new EdgeStoreError({
                    message: 'Bucket paths cannot contain empty segments.',
                    code: 'SERVER_ERROR',
                  });
                }
                const [key, value] = entry;
                return { key, value: value() };
              }),
              accessControl: bucket._def.accessControl,
            },
          ]),
        ),
      });
      return {
        token,
      };
    },
    getBaseUrl() {
      return baseUrl;
    },
    getFile: async ({ url }) => {
      const file = await backend.getFile({ file: { url } });
      return {
        url: file.url,
        size: file.sizeBytes,
        uploadedAt: file.uploadedAt,
        path: file.path,
        metadata: file.metadata,
      };
    },
    async requestUpload({
      bucketName,
      bucketType,
      fileInfo,
      autoSignedUrls,
    }): Promise<RequestUploadRes> {
      let partSize = DEFAULT_MULTIPART_PART_SIZE_BYTES;
      if (fileInfo.size > DEFAULT_MULTIPART_THRESHOLD_BYTES) {
        let totalParts = Math.ceil(fileInfo.size / partSize);
        if (totalParts > 10_000) {
          totalParts = 10_000;
          partSize = Math.ceil(fileInfo.size / totalParts);
        }
        return mapUploadResponse(
          await sdk.runtime.uploads.request({
            bucket: bucketName,
            ...mapUploadRequest(bucketType, fileInfo, autoSignedUrls),
            multipart: {
              partNumbers: Array.from(
                { length: totalParts },
                (_, index) => index + 1,
              ),
            },
          }),
          { partSize, totalParts },
        );
      }
      return mapUploadResponse(
        await sdk.runtime.uploads.request({
          bucket: bucketName,
          ...mapUploadRequest(bucketType, fileInfo, autoSignedUrls),
        }),
      );
    },
    requestUploadParts: async ({ multipart }) => {
      const res = await sdk.runtime.uploads.createParts({
        uploadId: multipart.uploadId,
        partNumbers: multipart.parts,
      });
      return {
        multipart: {
          uploadId: multipart.uploadId,
          parts: res.parts.map((part) => ({
            partNumber: part.partNumber,
            uploadUrl: part.signedUrl,
          })),
        },
      };
    },
    getSignedUrls: async (params) => {
      const { signedUrls } = await sdk.runtime.files.createSignedUrls({
        bucket: params.bucketName,
        urls: params.urls,
        expiresIn: params.expiresIn,
        includeThumbnails: params.includeThumbnails,
      });
      return signedUrls.map((item) => ({
        ...item,
        expiresAt: new Date(item.expiresAt),
      }));
    },
    listFiles: async ({ bucketName, ...params }) => {
      const { files, pagination } = await sdk.runtime.files.search({
        bucket: bucketName,
        ...params,
      });
      return {
        data: files.map((file) => ({
          url: file.url,
          thumbnailUrl: file.thumbnailUrl,
          size: file.sizeBytes,
          uploadedAt: new Date(file.uploadedAt),
          path: file.path,
          metadata: file.metadata,
        })),
        pagination,
      };
    },
    completeMultipartUpload: async ({ uploadId, parts }) => {
      await sdk.runtime.uploads.completeMultipart({
        uploadId,
        parts,
      });
      return { success: true };
    },
    confirmUpload: async ({ url }) => {
      await sdk.runtime.files.confirm({ file: { url } });
      return { success: true };
    },
    deleteFile: async ({ url }) => {
      await sdk.runtime.files.delete({ file: { url } });
      return { success: true };
    },
    backend,
  };
}

function getApiUrl() {
  const configured = getEnv('EDGE_STORE_API_ENDPOINT');
  if (!configured) return undefined;
  const base = configured.replace(/\/+$/, '');
  return base.endsWith('/v2') ? base : `${base}/v2`;
}

function normalizeMetadata(
  metadata: Record<string, string | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(metadata).filter(
      (entry): entry is [string, string] => entry[1] != null,
    ),
  );
}

function mapUploadRequest(
  bucketType: string,
  fileInfo: Parameters<Provider['requestUpload']>[0]['fileInfo'],
  signedReadUrl: Parameters<Provider['requestUpload']>[0]['autoSignedUrls'],
) {
  return {
    bucketType: bucketType.toLowerCase() as 'file' | 'image',
    visibility: fileInfo.isPublic
      ? ('public' as const)
      : ('protected' as const),
    fileName: fileInfo.fileName,
    mimeType: fileInfo.type,
    temporary: fileInfo.temporary,
    path: fileInfo.path,
    extension: fileInfo.extension,
    sizeBytes: fileInfo.size,
    metadata: normalizeMetadata(fileInfo.metadata),
    replaceTarget: fileInfo.replaceTargetUrl
      ? { url: fileInfo.replaceTargetUrl }
      : undefined,
    signedReadUrl,
  };
}

function mapUploadResponse(
  res: Awaited<
    ReturnType<
      ReturnType<typeof createEdgeStoreSdk>['runtime']['uploads']['request']
    >
  >,
  multipartConfig?: { partSize: number; totalParts: number },
): RequestUploadRes {
  const signed = res.signedReadUrl;
  const access = {
    accessUrl: res.file.url,
    thumbnailUrl: res.file.thumbnailUrl,
    accessSignedUrl: signed?.signedUrl,
    accessSignedThumbnailUrl: signed?.signedThumbnailUrl,
    accessSignedUrlExpiresAt: signed?.expiresAt,
    accessSignedUrlExpiresIn: signed?.expiresIn,
  };
  if (res.upload.kind === 'single') {
    return { ...access, uploadUrl: res.upload.signedUrl };
  }
  if (!multipartConfig) {
    throw new EdgeStoreError({
      message: 'Missing multipart configuration.',
      code: 'SERVER_ERROR',
    });
  }
  return {
    ...access,
    multipart: {
      key: res.file.key,
      uploadId: res.upload.id,
      parts: res.upload.parts.map((part) => ({
        partNumber: part.partNumber,
        uploadUrl: part.signedUrl,
      })),
      ...multipartConfig,
    },
  };
}

function mapFile(
  file: Awaited<
    ReturnType<
      ReturnType<typeof createEdgeStoreSdk>['runtime']['files']['lookup']
    >
  >['file'],
): ProviderFile {
  return {
    ...file,
    uploadedAt: new Date(file.uploadedAt),
    updatedAt: new Date(file.updatedAt),
  };
}
