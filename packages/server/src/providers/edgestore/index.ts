import {
  createEdgeStoreSdk,
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
  type ProjectRuntimeClient,
} from '@edgestore/sdk';
import {
  EdgeStoreError,
  type ProviderFile,
  type ProviderFileMutationResult,
  type RequestUploadParams,
  type RequestUploadRes,
  type RouterFileFieldsProvider,
} from '@edgestore/shared';
import { z } from 'zod';
import { defineProvider } from '../../core/provider';
import { getEnv } from '../../libs/env';
import EdgeStoreCredentialsError from '../../libs/errors/EdgeStoreCredentialsError';

const DEFAULT_BASE_URL = 'https://files.edgestore.dev';

const fileReferenceSchema = z
  .union([
    z.string(),
    z.object({ id: z.string() }),
    z.object({ key: z.string() }),
    z.object({ url: z.string() }),
  ])
  .transform((reference) =>
    typeof reference === 'string' ? { url: reference } : reference,
  );

type EdgeStoreProviderCommonOptions = {
  /** Override the complete API v2 URL. */
  apiUrl?: string;
};

type EdgeStoreProjectProviderOptions = {
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
  token?: never;
  project?: never;
};

type EdgeStoreBearerProviderOptions = {
  /** Bearer token used to authenticate API v2 requests. */
  token: string;
  /** Project ID or slug used by runtime operations. */
  project: string;
  accessKey?: never;
  secretKey?: never;
};

export type EdgeStoreProviderOptions = EdgeStoreProviderCommonOptions &
  (EdgeStoreProjectProviderOptions | EdgeStoreBearerProviderOptions);

export function edgestore(options?: EdgeStoreProviderOptions) {
  const baseUrl = getEnv('EDGE_STORE_BASE_URL') ?? DEFAULT_BASE_URL;
  const runtime = createProviderRuntime(options);

  const provider = defineProvider({
    name: 'edgestore',
    baseUrl,
    reference: {
      schema: fileReferenceSchema,
      fromUrl: (url) => ({ url }),
    },
    init: async ({ ctx, router }) => {
      const requiresFileAccessCookie = Object.values(router.buckets).some(
        (bucket) =>
          bucket._def.accessControl !== undefined &&
          bucket._def.accessControl !== 'private',
      );
      if (!requiresFileAccessCookie) return {};

      const { token } = await runtime.accessTokens.create({
        context: Object.fromEntries(
          Object.entries(ctx).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
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
        clientInit: {
          path: '/_init',
          headers: {
            'x-edgestore-token': token,
          },
        },
      };
    },
    uploads: {
      async request({
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
            await runtime.uploads.request({
              bucket: bucketName,
              ...mapRawUploadRequest(bucketType, fileInfo, autoSignedUrls),
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
          await runtime.uploads.request({
            bucket: bucketName,
            ...mapRawUploadRequest(bucketType, fileInfo, autoSignedUrls),
          }),
        );
      },
      multipart: {
        requestParts: async ({ multipart }) => {
          const res = await runtime.uploads.createParts({
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
        complete: async ({ uploadId, parts }) => {
          await runtime.uploads.completeMultipart({
            uploadId,
            parts,
          });
        },
      },
      upload: async ({
        bucketName,
        fileInfo,
        autoSignedUrls,
        source,
        signal,
        onProgress,
      }) => {
        const result = await runtime.uploads.upload({
          bucket: bucketName,
          source,
          ...mapHighLevelUploadOptions(fileInfo, autoSignedUrls),
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
    },
    files: {
      cursorSchema: z.string(),
      get: async ({ bucketName, file: fileRef }) => {
        const { file } = await runtime.files.lookup({
          bucketName,
          file: fileRef,
        });
        return mapFile(file);
      },
      list: async ({ bucketName, filter, cursor, limit }) => {
        const { files, pagination } = await runtime.files.search({
          bucket: bucketName,
          filter,
          pagination: { cursor, limit },
        });
        return {
          items: files.map(mapFile),
          ...pagination,
        };
      },
      confirm: async ({ bucketName, files }) =>
        mapMutationResult(
          await runtime.files.confirmMany({ bucketName, files }),
        ),
      delete: async ({ bucketName, files }) =>
        mapMutationResult(
          await runtime.files.deleteMany({ bucketName, files }),
        ),
      restore: async ({ bucketName, files }) =>
        mapMutationResult(
          await runtime.files.restoreMany({ bucketName, files }),
        ),
      getSignedUrls: async (params) => {
        const urls = await Promise.all(
          params.files.map(async (fileRef) =>
            'url' in fileRef
              ? fileRef.url
              : (
                  await runtime.files.lookup({
                    bucketName: params.bucketName,
                    file: fileRef,
                  })
                ).file.url,
          ),
        );
        const { signedUrls } = await runtime.files.generateSignedReadUrls({
          bucket: params.bucketName,
          urls,
          expiresIn: params.expiresIn,
          includeThumbnails: params.includeThumbnails,
        });
        return signedUrls.map((item) => ({
          ...item,
          expiresAt: new Date(item.expiresAt),
        }));
      },
    },
  });

  return provider as typeof provider & RouterFileFieldsProvider;
}

export type EdgeStoreBackendProvider = ReturnType<typeof edgestore>;

type ResolvedProviderAuthentication =
  | {
      kind: 'project';
      accessKey: string;
      secretKey: string;
    }
  | {
      kind: 'bearer';
      token: string;
      project: string;
    };

function createProviderRuntime(
  options?: EdgeStoreProviderOptions,
): ProjectRuntimeClient {
  const authentication = resolveProviderAuthentication(options);
  const apiUrl = options?.apiUrl ?? getApiUrl();

  if (authentication.kind === 'bearer') {
    const sdk = createEdgeStoreSdk({
      credentials: { token: authentication.token },
      apiUrl,
    });
    return sdk.runtime.forProject(authentication.project);
  }

  const sdk = createEdgeStoreSdk({
    credentials: {
      accessKey: authentication.accessKey,
      secretKey: authentication.secretKey,
    },
    apiUrl,
  });
  return sdk.runtime;
}

function resolveProviderAuthentication(
  options?: EdgeStoreProviderOptions,
): ResolvedProviderAuthentication {
  const values = (options ?? {}) as Record<string, unknown>;
  const token = values.token;
  const project = values.project;
  const configuredAccessKey = values.accessKey;
  const configuredSecretKey = values.secretKey;

  if (token !== undefined) {
    if (
      configuredAccessKey !== undefined ||
      configuredSecretKey !== undefined
    ) {
      throw new TypeError(
        'EdgeStore provider credentials cannot contain both a Bearer token and project keys.',
      );
    }
    assertNonEmptyProviderOption(token, 'token');
    assertNonEmptyProviderOption(project, 'project');
    return { kind: 'bearer', token, project };
  }

  if (project !== undefined) {
    throw new TypeError(
      'EdgeStore provider option `project` requires a Bearer token.',
    );
  }

  const accessKey =
    configuredAccessKey ??
    getEnv('EDGE_STORE_ACCESS_KEY') ??
    // @ts-expect-error - In Vite/Astro, the env variables are available on `import.meta`.
    import.meta.env?.EDGE_STORE_ACCESS_KEY;
  const secretKey =
    configuredSecretKey ??
    getEnv('EDGE_STORE_SECRET_KEY') ??
    // @ts-expect-error - In Vite/Astro, the env variables are available on `import.meta`.
    import.meta.env?.EDGE_STORE_SECRET_KEY;

  if (
    typeof accessKey !== 'string' ||
    !accessKey.trim() ||
    typeof secretKey !== 'string' ||
    !secretKey.trim()
  ) {
    throw new EdgeStoreCredentialsError();
  }

  return { kind: 'project', accessKey, secretKey };
}

function assertNonEmptyProviderOption(
  value: unknown,
  name: string,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(
      `EdgeStore provider option \`${name}\` must not be empty.`,
    );
  }
}

function mapMutationResult<TErrorCode extends string>(result: {
  results: (
    | { success: true }
    | {
        success: false;
        error: {
          code: TErrorCode;
          message: string;
        };
      }
  )[];
}): ProviderFileMutationResult<TErrorCode> {
  return {
    results: result.results.map((item) =>
      item.success
        ? { success: true as const }
        : { success: false as const, error: item.error },
    ),
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

function mapHighLevelUploadOptions(
  fileInfo: RequestUploadParams['fileInfo'],
  signedReadUrl: RequestUploadParams['autoSignedUrls'],
) {
  return {
    fileName: fileInfo.fileName,
    mimeType: fileInfo.type,
    temporary: fileInfo.temporary,
    path: fileInfo.path,
    extension: fileInfo.extension,
    metadata: normalizeMetadata(fileInfo.metadata),
    replaceTarget: fileInfo.replaceTargetUrl
      ? { url: fileInfo.replaceTargetUrl }
      : undefined,
    signedReadUrl,
  };
}

function mapRawUploadRequest(
  bucketType: string,
  fileInfo: RequestUploadParams['fileInfo'],
  signedReadUrl: RequestUploadParams['autoSignedUrls'],
) {
  return {
    bucketType: bucketType.toLowerCase() as 'file' | 'image',
    visibility: fileInfo.isPublic
      ? ('public' as const)
      : ('protected' as const),
    sizeBytes: fileInfo.size,
    ...mapHighLevelUploadOptions(fileInfo, signedReadUrl),
  };
}

function mapUploadResponse(
  res: Awaited<ReturnType<ProjectRuntimeClient['uploads']['request']>>,
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
  file: Awaited<ReturnType<ProjectRuntimeClient['files']['lookup']>>['file'],
): ProviderFile {
  return {
    ...file,
    uploadedAt: new Date(file.uploadedAt),
    updatedAt: new Date(file.updatedAt),
  };
}
