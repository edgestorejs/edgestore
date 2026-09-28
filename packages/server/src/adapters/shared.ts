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
  type SharedUploadStatusRes,
} from '@edgestore/shared';
import { stringifySetCookie } from 'cookie';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { z } from 'zod';
import {
  assertSupportedUploadOptions,
  referenceFromUrl,
} from '../core/provider';
import { buildPath, parseBucketInput, parsePath } from '../core/routerRules';
import { validateFileForBucket } from '../core/validateFile';
import { getEnv } from '../libs/env';
import type { LoggerLike } from '../libs/logger';

// TODO: change it to 1 hour when we have a way to refresh the token
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export type HandlerRouter<TCtx extends AnyContext> = EdgeStoreRouter<TCtx> & {
  readonly _def: { readonly provider: AnyEdgeStoreProvider };
};

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
};

type ResolvedCookieConfig = {
  ctx: {
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
  // Explicit `undefined` options keep their defaults.
  const configured = Object.fromEntries(
    Object.entries(cookieConfig?.ctx?.options ?? {}).filter(
      ([, value]) => value !== undefined,
    ),
  );

  return {
    ctx: {
      name: cookieConfig?.ctx?.name ?? 'edgestore-ctx',
      options: { path: '/', maxAge: DEFAULT_MAX_AGE, ...configured },
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
  const { clientInit } = await provider.init({ ctx, router });
  const newCookies = [
    stringifySetCookie({
      name: resolvedCookieConfig.ctx.name,
      value: ctxToken,
      ...resolvedCookieConfig.ctx.options,
    }),
  ];

  logger.debug('Finished [init]', { ctx, newCookies, clientInit });

  return { newCookies, clientInit };
}

const nonEmptyStringSchema = z.string().min(1);

export const requestUploadBodySchema = z.object({
  bucketName: nonEmptyStringSchema,
  input: z.unknown(),
  fileInfo: z.object({
    size: z.number().int().nonnegative(),
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

  const ctx = await getContext(ctxToken);
  logger.debug('Decrypted Context', { ctx });
  const bucket = getBucket(router, bucketName);
  assertSupportedUploadOptions(provider, fileInfo);
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
  const statusToken =
    provider.uploads.getStatus && requestUploadRes.id
      ? await encryptStatusToken({ id: requestUploadRes.id, bucketName })
      : undefined;

  logger.debug('Finished [requestUpload]');

  return {
    ...requestUploadRes,
    size: fileInfo.size,
    path: parsedPath,
    pathOrder,
    metadata,
    statusToken,
  };
}

export const uploadStatusBodySchema = z.object({
  statusToken: nonEmptyStringSchema,
});

export type UploadStatusBody = z.infer<typeof uploadStatusBodySchema>;

/** Reports processing state for an upload authorized by its status token. */
export async function getUploadStatus<TCtx extends AnyContext>(params: {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: UploadStatusBody;
  logger: LoggerLike;
}): Promise<SharedUploadStatusRes> {
  const { provider, router, ctxToken, logger, body } = params;

  await getContext(ctxToken);
  const { id, bucketName } = await decryptStatusToken(body.statusToken);
  logger.debug('Running [getUploadStatus]', { bucketName, id });
  const bucket = getBucket(router, bucketName);

  if (!provider.uploads.getStatus) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not report upload status.`,
      code: 'BAD_REQUEST',
    });
  }
  const result = await provider.uploads.getStatus({ bucketName, id });

  logger.debug('Finished [getUploadStatus]', { status: result.status });

  if (result.status !== 'completed') return { status: result.status };
  const { url, key, thumbnailUrl, sizeBytes } = result.file;
  // Processing may add a thumbnail that the upload response could not sign.
  const { autoSignedUrls } = bucket._def;
  const [signed] =
    autoSignedUrls && provider.files.getSignedUrls
      ? await provider.files.getSignedUrls({
          bucketName,
          files: [await referenceFromUrl(provider, url)],
          ...autoSignedUrls,
        })
      : [];
  return {
    status: 'completed',
    file: { url, key, thumbnailUrl: thumbnailUrl ?? null, size: sizeBytes },
    ...(signed && {
      signedReadUrl: {
        signedUrl: signed.signedUrl,
        signedThumbnailUrl: signed.signedThumbnailUrl ?? null,
        expiresAt: signed.expiresAt,
        expiresIn: signed.expiresIn,
      },
    }),
  };
}

const multipartSessionBodySchema = z.object({
  bucketName: nonEmptyStringSchema,
  uploadId: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
});

/** Bounds the presigning work one request can trigger. Clients ask for 10. */
const MAX_PART_URLS_PER_REQUEST = 100;

export const requestUploadPartsBodySchema = multipartSessionBodySchema.extend({
  parts: z
    .array(z.number().int().positive())
    .min(1)
    .max(MAX_PART_URLS_PER_REQUEST),
});

export const completeMultipartUploadBodySchema =
  multipartSessionBodySchema.extend({
    parts: z.array(
      z.object({
        partNumber: z.number().int().positive(),
        eTag: nonEmptyStringSchema.optional(),
      }),
    ),
  });

export const abortMultipartUploadBodySchema = multipartSessionBodySchema;

export type RequestUploadPartsBody = z.infer<
  typeof requestUploadPartsBodySchema
>;
export type CompleteMultipartUploadBody = z.infer<
  typeof completeMultipartUploadBodySchema
>;
export type AbortMultipartUploadBody = z.infer<
  typeof abortMultipartUploadBodySchema
>;

type MultipartRequest<TCtx extends AnyContext, TBody> = {
  provider: AnyEdgeStoreProvider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: TBody;
  logger: LoggerLike;
};

/** Authorizes a multipart session request and returns the provider operations. */
async function getMultipartUploads<TCtx extends AnyContext>({
  provider,
  router,
  ctxToken,
  body: { bucketName },
}: MultipartRequest<TCtx, { bucketName: string }>) {
  await getContext(ctxToken);
  getBucket(router, bucketName);
  const multipartUploads = provider.uploads.multipart;
  if (!multipartUploads) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not support multipart uploads.`,
      code: 'BAD_REQUEST',
    });
  }
  return multipartUploads;
}

export async function requestUploadParts<TCtx extends AnyContext>(
  params: MultipartRequest<TCtx, RequestUploadPartsBody>,
): Promise<SharedRequestUploadPartsRes> {
  const { bucketName, uploadId, key, parts } = params.body;
  params.logger.debug('Running [requestUploadParts]', {
    bucketName,
    uploadId,
    key,
    parts,
  });
  const multipartUploads = await getMultipartUploads(params);
  const res = await multipartUploads.requestParts({ uploadId, key, parts });
  params.logger.debug('Finished [requestUploadParts]');
  return res;
}

export async function completeMultipartUpload<TCtx extends AnyContext>(
  params: MultipartRequest<TCtx, CompleteMultipartUploadBody>,
) {
  const { bucketName, uploadId, key, parts } = params.body;
  params.logger.debug('Running [completeMultipartUpload]', {
    bucketName,
    uploadId,
    key,
  });
  const multipartUploads = await getMultipartUploads(params);
  await multipartUploads.complete({ uploadId, key, parts });
  params.logger.debug('Finished [completeMultipartUpload]');
}

export async function abortMultipartUpload<TCtx extends AnyContext>(
  params: MultipartRequest<TCtx, AbortMultipartUploadBody>,
) {
  const { bucketName, uploadId, key } = params.body;
  params.logger.debug('Running [abortMultipartUpload]', {
    bucketName,
    uploadId,
    key,
  });
  const multipartUploads = await getMultipartUploads(params);
  await multipartUploads.abort({ uploadId, key });
  params.logger.debug('Finished [abortMultipartUpload]');
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

  await getContext(ctxToken);
  getBucket(router, bucketName);

  if (!provider.files.confirm) {
    throw new EdgeStoreError({
      message: `Provider ${provider.name} does not support file confirmation.`,
      code: 'SERVER_ERROR',
    });
  }
  const files = await Promise.all(
    urls.map((url) => referenceFromUrl(provider, url)),
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

  const ctx = await getContext(ctxToken);
  const bucket = getBucket(router, bucketName);

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
    urls.map((url) => referenceFromUrl(provider, url)),
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

function getBucket<TCtx extends AnyContext>(
  router: EdgeStoreRouter<TCtx>,
  bucketName: string,
) {
  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new EdgeStoreError({
      message: `Bucket ${bucketName} not found`,
      code: 'BAD_REQUEST',
    });
  }
  return bucket;
}

async function encryptJWT(ctx: AnyContext) {
  return await new EncryptJWT({ ctx })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Date.now() / 1000 + DEFAULT_MAX_AGE)
    .setJti(crypto.randomUUID())
    .encrypt(await getEncryptionKey());
}

/**
 * Status tokens bind one upload to the browser that requested it. They never
 * reach application code, so they carry no expiry: uploads can take arbitrarily
 * long, and the client bounds how long it waits for processing.
 */
async function encryptStatusToken(upload: { id: string; bucketName: string }) {
  return await new EncryptJWT({ upload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(await getEncryptionKey());
}

const statusTokenPayloadSchema = z.object({
  upload: z.object({
    id: nonEmptyStringSchema,
    bucketName: nonEmptyStringSchema,
  }),
});

async function decryptStatusToken(token: string) {
  const invalid = (cause?: Error) =>
    new EdgeStoreError({
      message: 'Invalid upload status token',
      code: 'BAD_REQUEST',
      cause,
    });
  const { payload } = await jwtDecrypt(token, await getEncryptionKey()).catch(
    (error: unknown) => {
      throw invalid(error instanceof Error ? error : undefined);
    },
  );
  const result = statusTokenPayloadSchema.safeParse(payload);
  if (!result.success) throw invalid(result.error);
  return result.data.upload;
}

const contextPayloadSchema = z.object({
  ctx: z.record(z.string(), z.string()),
});

/** Decrypts and validates the `edgestore-ctx` cookie set by `/init`. */
async function getContext(token: string | undefined) {
  if (!token) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  const key = await getEncryptionKey();
  const payload = await jwtDecrypt(token, key, { clockTolerance: 15 }).then(
    (result) => result.payload,
    (error: unknown) => {
      throw new EdgeStoreError({
        message: 'Invalid edgestore-ctx cookie',
        code: 'UNAUTHORIZED',
        cause: error instanceof Error ? error : undefined,
      });
    },
  );
  const result = contextPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new EdgeStoreError({
      message: 'Invalid edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
      cause: result.error,
    });
  }
  return result.data.ctx;
}

/** Derives the context-cookie encryption key from the configured secret. */
async function getEncryptionKey() {
  const secret =
    getEnv('EDGESTORE_JWT_SECRET') ?? getEnv('EDGESTORE_SECRET_KEY');
  if (!secret) {
    throw new EdgeStoreError({
      message: 'EDGESTORE_JWT_SECRET or EDGESTORE_SECRET_KEY is not defined',
      code: 'SERVER_ERROR',
    });
  }
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'HKDF',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: encoder.encode('EdgeStore Generated Encryption Key'),
    },
    material,
    256,
  );
  return new Uint8Array(bits);
}
