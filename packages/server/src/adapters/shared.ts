import {
  EdgeStoreError,
  type AnyContext,
  type AnyEdgeStoreProvider,
  type EdgeStoreRouter,
  type ProviderFileMutationResult,
  type SharedConfirmUploadsRes,
  type SharedDeleteFilesRes,
  type SharedInitRes,
  type SharedRequestUploadPartsRes,
  type SharedRequestUploadRes,
} from '@edgestore/shared';
import { hkdf } from '@panva/hkdf';
import { stringifySetCookie } from 'cookie';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { z } from 'zod';
import { getProviderBaseUrl, referenceFromUrl } from '../core/provider';
import { buildPath, parseBucketInput, parsePath } from '../core/routerRules';
import { validateFileForBucket } from '../core/validateFile';
import { getEnv, isDev } from '../libs/env';
import type { LoggerLike } from '../libs/logger';

// TODO: change it to 1 hour when we have a way to refresh the token
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export type HandlerEdgeStore<TCtx extends AnyContext> = {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
};

const NO_BODY_STATUSES = new Set([204, 205, 304]);

export async function fetchProxyFile({
  cookieHeader,
  url,
}: {
  cookieHeader?: string;
  url: string;
}) {
  const proxyRes = await fetch(url, {
    headers: {
      cookie: cookieHeader ?? '',
    },
  });

  const body = NO_BODY_STATUSES.has(proxyRes.status)
    ? null
    : await proxyRes.arrayBuffer();

  return {
    body,
    contentType:
      proxyRes.headers.get('Content-Type') ?? 'application/octet-stream',
    status: proxyRes.status,
  };
}

export type CookieOptions = {
  /**
   * Cookie path
   * @default "/"
   */
  path?: string;
  /**
   * Cookie max age in seconds
   * @default 2592000 (30 days)
   */
  maxAge?: number;
  /**
   * Cookie domain
   */
  domain?: string;
  /**
   * Cookie same site policy
   */
  sameSite?: 'strict' | 'lax' | 'none';
  /**
   * Cookie secure flag
   */
  secure?: boolean;
  /**
   * Cookie http only flag
   */
  httpOnly?: boolean;
};

export type CookieConfig = {
  /**
   * Context cookie configuration
   */
  ctx?: {
    /**
     * Name of the context cookie
     * @default "edgestore-ctx"
     */
    name?: string;
    /**
     * Cookie options for context cookie
     */
    options?: CookieOptions;
  };
  /**
   * Token cookie configuration
   */
  token?: {
    /**
     * Name of the token cookie
     * @default "edgestore-token"
     */
    name?: string;
    /**
     * Cookie options for token cookie
     */
    options?: CookieOptions;
  };
};

type ResolvedCookieConfig = {
  ctx: {
    name: string;
    options: CookieOptions;
  };
  token: {
    name: string;
    options: CookieOptions;
  };
};

/**
 * Merges the provided cookie configuration with default values
 */
export function getCookieConfig(
  cookieConfig?: CookieConfig,
): ResolvedCookieConfig {
  const defaultOptions: CookieOptions = {
    path: '/',
    maxAge: DEFAULT_MAX_AGE,
  };

  // Helper function to merge options, filtering out undefined values
  const mergeOptions = (configOptions?: CookieOptions): CookieOptions => {
    const merged = { ...defaultOptions };

    if (configOptions) {
      Object.keys(configOptions).forEach((key) => {
        const value = configOptions[key as keyof CookieOptions];
        if (value !== undefined) {
          (merged as any)[key] = value;
        }
      });
    }

    return merged;
  };

  return {
    ctx: {
      name: cookieConfig?.ctx?.name ?? 'edgestore-ctx',
      options: mergeOptions(cookieConfig?.ctx?.options),
    },
    token: {
      name: cookieConfig?.token?.name ?? 'edgestore-token',
      options: mergeOptions(cookieConfig?.token?.options),
    },
  };
}

export async function init<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctx: TCtx;
  logger: LoggerLike;
  cookieConfig?: CookieConfig;
}): Promise<SharedInitRes> {
  const { ctx, provider, router, logger, cookieConfig } = params;
  logger.debug('Running [init]', { ctx });

  const resolvedCookieConfig = getCookieConfig(cookieConfig);

  const ctxToken = await encryptJWT(ctx);
  const initRes = await provider.init({ ctx, router });
  const newCookies = [
    stringifySetCookie({
      name: resolvedCookieConfig.ctx.name,
      value: ctxToken,
      ...resolvedCookieConfig.ctx.options,
    }),
  ];
  if (initRes.token) {
    newCookies.push(
      stringifySetCookie({
        name: resolvedCookieConfig.token.name,
        value: initRes.token,
        ...resolvedCookieConfig.token.options,
      }),
    );
  }
  const baseUrl = await getProviderBaseUrl(provider);

  logger.debug('Finished [init]', {
    ctx,
    newCookies,
    baseUrl,
    providerName: provider.name,
    clientInit: initRes.clientInit,
  });

  return {
    newCookies,
    baseUrl,
    providerName: provider.name,
    clientInit: initRes.clientInit,
  };
}

const nonEmptyStringSchema = z.string().min(1);

export const requestUploadBodySchema = z.object({
  bucketName: nonEmptyStringSchema,
  input: z.unknown().default({}),
  fileInfo: z.object({
    size: z.number().finite().nonnegative(),
    type: z.string(),
    extension: z.string(),
    fileName: z.string().optional(),
    replaceTargetUrl: nonEmptyStringSchema.optional(),
    temporary: z.boolean().default(false),
  }),
});

export type RequestUploadBody = z.infer<typeof requestUploadBodySchema>;

export async function requestUpload<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: RequestUploadBody;
  logger: LoggerLike;
}): Promise<SharedRequestUploadRes> {
  const {
    provider,
    router,
    ctxToken,
    logger,
    body: { bucketName, input, fileInfo },
  } = params;
  logger.debug('Running [requestUpload]', { bucketName, input, fileInfo });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  const ctx = await getContext(ctxToken);

  logger.debug('Decrypted Context', { ctx });

  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new EdgeStoreError({
      message: `Bucket ${bucketName} not found`,
      code: 'BAD_REQUEST',
    });
  }
  const parsedInput = await parseBucketInput(bucket, input);
  if (bucket._def.beforeUpload) {
    logger.debug('Running [beforeUpload]');
    const canUpload = await bucket._def.beforeUpload?.({
      ctx,
      input: parsedInput,
      fileInfo: {
        size: fileInfo.size,
        type: fileInfo.type,
        fileName: fileInfo.fileName,
        extension: fileInfo.extension,
        replaceTargetUrl: fileInfo.replaceTargetUrl,
        temporary: fileInfo.temporary,
      },
    });
    logger.debug('Finished [beforeUpload]', { canUpload });
    if (!canUpload) {
      throw new EdgeStoreError({
        message: 'Upload not allowed for the current context',
        code: 'UPLOAD_NOT_ALLOWED',
      });
    }
  }

  validateFileForBucket({ bucket, fileInfo });

  const path = buildPath({
    bucket,
    pathAttrs: { ctx, input: parsedInput },
  });
  const metadata =
    (await bucket._def.metadata?.({
      ctx,
      input: parsedInput,
    })) ?? {};
  const isPublic = bucket._def.accessControl === undefined;
  const autoSignedUrls = bucket._def.autoSignedUrls;

  logger.debug('upload info', {
    path,
    metadata,
    isPublic,
    bucketType: bucket._def.type,
  });

  const requestUploadRes = await provider.uploads.request({
    bucketName,
    bucketType: bucket._def.type,
    fileInfo: {
      ...fileInfo,
      path,
      isPublic,
      metadata,
    },
    autoSignedUrls,
  });
  const { parsedPath, pathOrder } = parsePath(path);

  logger.debug('Finished [requestUpload]');

  return {
    ...requestUploadRes,
    size: fileInfo.size,
    uploadedAt: new Date().toISOString(), // TODO: maybe delete this field since it's not the actual upload time
    path: parsedPath,
    pathOrder,
    metadata,
  };
}

export const requestUploadPartsBodySchema = z.object({
  multipart: z.object({
    uploadId: nonEmptyStringSchema,
    parts: z.array(z.number().int().positive()),
  }),
  path: nonEmptyStringSchema,
});

export type RequestUploadPartsParams = z.infer<
  typeof requestUploadPartsBodySchema
>;

export async function requestUploadParts<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: RequestUploadPartsParams;
  logger: LoggerLike;
}): Promise<SharedRequestUploadPartsRes> {
  const {
    provider,
    ctxToken,
    logger,
    body: { multipart, path },
  } = params;

  logger.debug('Running [requestUploadParts]', { multipart, path });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  await getContext(ctxToken); // just to check if the token is valid

  const multipartUploads = provider.uploads.multipart;
  if (!multipartUploads) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not support multipart uploads.`,
      code: 'BAD_REQUEST',
    });
  }
  const res = await multipartUploads.requestParts({
    multipart,
    path,
  });

  logger.debug('Finished [requestUploadParts]');

  return res;
}

export const completeMultipartUploadBodySchema = z.object({
  bucketName: nonEmptyStringSchema,
  uploadId: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
  parts: z.array(
    z.object({
      partNumber: z.number().int().positive(),
      eTag: nonEmptyStringSchema,
    }),
  ),
});

export type CompleteMultipartUploadBody = z.infer<
  typeof completeMultipartUploadBodySchema
>;

export async function completeMultipartUpload<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: CompleteMultipartUploadBody;
  logger: LoggerLike;
}) {
  const {
    provider,
    router,
    ctxToken,
    logger,
    body: { bucketName, uploadId, key, parts },
  } = params;

  logger.debug('Running [completeMultipartUpload]', {
    bucketName,
    uploadId,
    key,
  });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  await getContext(ctxToken); // just to check if the token is valid
  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new EdgeStoreError({
      message: `Bucket ${bucketName} not found`,
      code: 'BAD_REQUEST',
    });
  }

  const multipartUploads = provider.uploads.multipart;
  if (!multipartUploads) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not support multipart uploads.`,
      code: 'BAD_REQUEST',
    });
  }
  await multipartUploads.complete({
    uploadId,
    key,
    parts,
  });

  logger.debug('Finished [completeMultipartUpload]');
}

export const confirmUploadsBodySchema = z.object({
  bucketName: nonEmptyStringSchema,
  urls: z.array(nonEmptyStringSchema),
});

export type ConfirmUploadsBody = z.infer<typeof confirmUploadsBodySchema>;

export async function confirmUploads<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: ConfirmUploadsBody;
  logger: LoggerLike;
}): Promise<SharedConfirmUploadsRes> {
  const {
    provider,
    router,
    ctxToken,
    logger,
    body: { bucketName, urls },
  } = params;

  logger.debug('Running [confirmUploads]', { bucketName, urls });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  await getContext(ctxToken); // just to check if the token is valid
  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new EdgeStoreError({
      message: `Bucket ${bucketName} not found`,
      code: 'BAD_REQUEST',
    });
  }

  if (!provider.files.confirm) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not support file confirmation.`,
      code: 'SERVER_ERROR',
    });
  }
  const files = await Promise.all(
    urls.map((url) => referenceFromUrl(provider, unproxyUrl(url))),
  );
  const result = await provider.files.confirm({
    bucketName,
    files,
  });

  logger.debug('Finished [confirmUploads]');
  return mapFrontendMutationResult(urls, result);
}

export const deleteFilesBodySchema = z.object({
  bucketName: nonEmptyStringSchema,
  urls: z.array(nonEmptyStringSchema),
});

export type DeleteFilesBody = z.infer<typeof deleteFilesBodySchema>;

export async function deleteFiles<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: DeleteFilesBody;
  logger: LoggerLike;
}): Promise<SharedDeleteFilesRes> {
  const {
    provider,
    router,
    ctxToken,
    logger,
    body: { bucketName, urls },
  } = params;

  logger.debug('Running [deleteFiles]', { bucketName, urls });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  const ctx = await getContext(ctxToken);
  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new EdgeStoreError({
      message: `Bucket ${bucketName} not found`,
      code: 'BAD_REQUEST',
    });
  }

  if (!bucket._def.beforeDelete) {
    throw new EdgeStoreError({
      message:
        'You need to define beforeDelete if you want to delete files directly from the frontend.',
      code: 'SERVER_ERROR',
    });
  }

  if (!provider.files.delete) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not support file deletion.`,
      code: 'SERVER_ERROR',
    });
  }
  const files = await Promise.all(
    urls.map((url) => referenceFromUrl(provider, unproxyUrl(url))),
  );
  const fileRecords = await Promise.all(
    files.map((file) =>
      Promise.resolve(provider.files.get({ bucketName, file })),
    ),
  );
  const authorizations = await Promise.all(
    fileRecords.map((file) => {
      if (file.path === undefined && bucket._def.path.length > 0) {
        throw new EdgeStoreError({
          message: `Provider ${provider.name} must return path from files.get to authorize frontend deletion for a bucket with configured path fields.`,
          code: 'SERVER_ERROR',
        });
      }
      if (file.metadata === undefined && bucket._def.metadata !== undefined) {
        throw new EdgeStoreError({
          message: `Provider ${provider.name} must return metadata from files.get to authorize frontend deletion for a bucket with configured metadata fields.`,
          code: 'SERVER_ERROR',
        });
      }
      return Promise.resolve(
        bucket._def.beforeDelete!({
          ctx,
          fileInfo: {
            url: file.url,
            size: file.sizeBytes,
            uploadedAt: new Date(file.uploadedAt),
            path: file.path ?? {},
            metadata: file.metadata ?? {},
          },
        }),
      );
    }),
  );
  if (authorizations.some((allowed) => !allowed)) {
    throw new EdgeStoreError({
      message: 'Delete not allowed for the current context',
      code: 'DELETE_NOT_ALLOWED',
    });
  }
  const result = await provider.files.delete({
    bucketName,
    files,
  });

  logger.debug('Finished [deleteFiles]');

  return mapFrontendMutationResult(urls, result);
}

function mapFrontendMutationResult(
  urls: string[],
  result: ProviderFileMutationResult<string>,
): SharedDeleteFilesRes {
  if (result.results.length !== urls.length) {
    throw new Error(
      `The provider returned ${result.results.length} mutation results for ${urls.length} files.`,
    );
  }
  const succeeded: string[] = [];
  const failed: SharedDeleteFilesRes['failed'] = [];
  result.results.forEach((item, index) => {
    const url = urls[index]!;
    if (item.success) succeeded.push(url);
    else failed.push({ url, error: item.error });
  });
  return { succeeded, failed };
}

async function encryptJWT(ctx: AnyContext) {
  const secret =
    getEnv('EDGE_STORE_JWT_SECRET') ?? getEnv('EDGE_STORE_SECRET_KEY');
  if (!secret) {
    throw new EdgeStoreError({
      message: 'EDGE_STORE_JWT_SECRET or EDGE_STORE_SECRET_KEY is not defined',
      code: 'SERVER_ERROR',
    });
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  return await new EncryptJWT({ ctx })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Date.now() / 1000 + DEFAULT_MAX_AGE)
    .setJti(crypto.randomUUID())
    .encrypt(encryptionSecret);
}

async function decryptJWT(token: string) {
  const secret =
    getEnv('EDGE_STORE_JWT_SECRET') ?? getEnv('EDGE_STORE_SECRET_KEY');
  if (!secret) {
    throw new EdgeStoreError({
      message: 'EDGE_STORE_JWT_SECRET or EDGE_STORE_SECRET_KEY is not defined',
      code: 'SERVER_ERROR',
    });
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  const { payload } = await jwtDecrypt(token, encryptionSecret, {
    clockTolerance: 15,
  });
  const result = z.object({ ctx: z.record(z.string()) }).safeParse(payload);
  if (!result.success) {
    throw new EdgeStoreError({
      message: 'Invalid edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
      cause: result.error,
    });
  }
  return result.data.ctx;
}

async function getDerivedEncryptionKey(secret: string) {
  return await hkdf(
    'sha256',
    secret,
    '',
    'EdgeStore Generated Encryption Key',
    32,
  );
}

async function getContext(token: string) {
  return await decryptJWT(token);
}

/**
 * On local development, protected files are proxied to the server,
 * which changes the original URL.
 *
 * This function is used to get the original URL,
 * so that we can delete or confirm the upload.
 */
function unproxyUrl(url: string) {
  if (isDev() && url.startsWith('http://')) {
    // get the url param from the query string
    const urlParam = new URL(url).searchParams.get('url');
    if (urlParam) {
      return urlParam;
    }
  }
  return url;
}
