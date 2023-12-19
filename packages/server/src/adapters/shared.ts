import {
  EdgeStoreError,
  type AnyBuilder,
  type EdgeStoreRouter,
  type Provider,
  type SharedDeleteFileRes,
  type SharedInitRes,
  type SharedRequestUploadPartsRes,
  type SharedRequestUploadRes,
} from '@edgestore/shared';
import { hkdf } from '@panva/hkdf';
import { serialize } from 'cookie';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import type Logger from '../libs/logger';
import { IMAGE_MIME_TYPES } from './imageTypes';

// TODO: change it to 1 hour when we have a way to refresh the token
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

export async function init<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctx: TCtx;
}): Promise<SharedInitRes> {
  const log = globalThis._EDGE_STORE_LOGGER;
  const { ctx, provider, router } = params;
  log.debug('Running [init]', { ctx });
  const ctxToken = await encryptJWT(ctx);
  const { token } = await provider.init({
    ctx,
    router: router,
  });
  const newCookies = [
    serialize('edgestore-ctx', ctxToken, {
      path: '/',
      maxAge: DEFAULT_MAX_AGE,
    }),
  ];
  if (token) {
    newCookies.push(
      serialize('edgestore-token', token, {
        path: '/',
        maxAge: DEFAULT_MAX_AGE,
      }),
    );
  }
  const baseUrl = await provider.getBaseUrl();

  log.debug('Finished [init]', { ctx, newCookies, token, baseUrl });

  return {
    newCookies,
    token,
    baseUrl,
  };
}

export type RequestUploadBody = {
  bucketName: string;
  input: any;
  fileInfo: {
    size: number;
    type: string;
    extension: string;
    fileName?: string;
    replaceTargetUrl?: string;
    temporary: boolean;
  };
};

export async function requestUpload<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: RequestUploadBody;
}): Promise<SharedRequestUploadRes> {
  const {
    provider,
    router,
    ctxToken,
    body: { bucketName, input, fileInfo },
  } = params;
  const log = globalThis._EDGE_STORE_LOGGER;
  log.debug('Running [requestUpload]', { bucketName, input, fileInfo });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  const ctx = await getContext(ctxToken);

  log.debug('Decrypted Context', { ctx });

  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new EdgeStoreError({
      message: `Bucket ${bucketName} not found`,
      code: 'BAD_REQUEST',
    });
  }
  if (bucket._def.beforeUpload) {
    log.debug('Running [beforeUpload]');
    const canUpload = await bucket._def.beforeUpload?.({
      ctx,
      input,
      fileInfo: {
        size: fileInfo.size,
        type: fileInfo.type,
        fileName: fileInfo.fileName,
        extension: fileInfo.extension,
        replaceTargetUrl: fileInfo.replaceTargetUrl,
        temporary: fileInfo.temporary,
      },
    });
    log.debug('Finished [beforeUpload]', { canUpload });
    if (!canUpload) {
      throw new EdgeStoreError({
        message: 'Upload not allowed for the current context',
        code: 'UPLOAD_NOT_ALLOWED',
      });
    }
  }

  if (bucket._def.type === 'IMAGE') {
    if (!IMAGE_MIME_TYPES.includes(fileInfo.type)) {
      throw new EdgeStoreError({
        code: 'MIME_TYPE_NOT_ALLOWED',
        message: 'Only images are allowed in this bucket',
        details: {
          allowedMimeTypes: IMAGE_MIME_TYPES,
          mimeType: fileInfo.type,
        },
      });
    }
  }

  if (bucket._def.bucketConfig?.maxSize) {
    if (fileInfo.size > bucket._def.bucketConfig.maxSize) {
      throw new EdgeStoreError({
        code: 'FILE_TOO_LARGE',
        message: `File size is too big. Max size is ${bucket._def.bucketConfig.maxSize}`,
        details: {
          maxFileSize: bucket._def.bucketConfig.maxSize,
          fileSize: fileInfo.size,
        },
      });
    }
  }

  if (bucket._def.bucketConfig?.accept) {
    const accept = bucket._def.bucketConfig.accept;
    let accepted = false;
    for (const acceptedMimeType of accept) {
      if (acceptedMimeType.endsWith('/*')) {
        const mimeType = acceptedMimeType.replace('/*', '');
        if (fileInfo.type.startsWith(mimeType)) {
          accepted = true;
          break;
        }
      } else if (fileInfo.type === acceptedMimeType) {
        accepted = true;
        break;
      }
    }
    if (!accepted) {
      throw new EdgeStoreError({
        code: 'MIME_TYPE_NOT_ALLOWED',
        message: `"${
          fileInfo.type
        }" is not allowed. Accepted types are ${JSON.stringify(accept)}`,
        details: {
          allowedMimeTypes: accept,
          mimeType: fileInfo.type,
        },
      });
    }
  }

  const path = buildPath({
    fileInfo,
    bucket,
    pathAttrs: { ctx, input },
  });
  const metadata = await bucket._def.metadata?.({ ctx, input });
  const isPublic = bucket._def.accessControl === undefined;

  log.debug('upload info', {
    path,
    metadata,
    isPublic,
    bucketType: bucket._def.type,
  });

  const requestUploadRes = await provider.requestUpload({
    bucketName,
    bucketType: bucket._def.type,
    fileInfo: {
      ...fileInfo,
      path,
      isPublic,
      metadata,
    },
  });
  const { parsedPath, pathOrder } = parsePath(path);

  log.debug('Finished [requestUpload]');

  return {
    ...requestUploadRes,
    size: fileInfo.size,
    uploadedAt: new Date().toISOString(),
    path: parsedPath,
    pathOrder,
    metadata,
  };
}

export type RequestUploadPartsParams = {
  multipart: {
    uploadId: string;
    parts: number[];
  };
  path: string;
};

export async function requestUploadParts<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: RequestUploadPartsParams;
}): Promise<SharedRequestUploadPartsRes> {
  const {
    provider,
    ctxToken,
    body: { multipart, path },
  } = params;

  const log = globalThis._EDGE_STORE_LOGGER;
  log.debug('Running [requestUploadParts]', { multipart, path });

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  await getContext(ctxToken); // just to check if the token is valid

  const res = await provider.requestUploadParts({
    multipart,
    path,
  });

  log.debug('Finished [requestUploadParts]');

  return res;
}

export type CompleteMultipartUploadBody = {
  bucketName: string;
  uploadId: string;
  key: string;
  parts: {
    partNumber: number;
    eTag: string;
  }[];
};

export async function completeMultipartUpload<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: CompleteMultipartUploadBody;
}) {
  const {
    provider,
    router,
    ctxToken,
    body: { bucketName, uploadId, key, parts },
  } = params;

  const log = globalThis._EDGE_STORE_LOGGER;
  log.debug('Running [completeMultipartUpload]', {
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

  const res = await provider.completeMultipartUpload({
    uploadId,
    key,
    parts,
  });

  log.debug('Finished [completeMultipartUpload]');

  return res;
}

export type ConfirmUploadBody = {
  bucketName: string;
  url: string;
};

export async function confirmUpload<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: ConfirmUploadBody;
}) {
  const {
    provider,
    router,
    ctxToken,
    body: { bucketName, url },
  } = params;

  const log = globalThis._EDGE_STORE_LOGGER;
  log.debug('Running [confirmUpload]', { bucketName, url });

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

  const res = await provider.confirmUpload({
    bucket,
    url: unproxyUrl(url),
  });

  log.debug('Finished [confirmUpload]');
  return res;
}

export type DeleteFileBody = {
  bucketName: string;
  url: string;
};

export async function deleteFile<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: DeleteFileBody;
}): Promise<SharedDeleteFileRes> {
  const {
    provider,
    router,
    ctxToken,
    body: { bucketName, url },
  } = params;

  const log = globalThis._EDGE_STORE_LOGGER;
  log.debug('Running [deleteFile]', { bucketName, url });

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

  const fileInfo = await provider.getFile({
    url: unproxyUrl(url),
  });

  const canDelete = await bucket._def.beforeDelete({
    ctx,
    fileInfo,
  });
  if (!canDelete) {
    throw new EdgeStoreError({
      message: 'Delete not allowed for the current context',
      code: 'DELETE_NOT_ALLOWED',
    });
  }
  const res = await provider.deleteFile({
    bucket,
    url: unproxyUrl(url),
  });

  log.debug('Finished [deleteFile]');

  return res;
}

async function encryptJWT(ctx: any) {
  const secret =
    process.env.EDGE_STORE_JWT_SECRET ?? process.env.EDGE_STORE_SECRET_KEY;
  if (!secret) {
    throw new EdgeStoreError({
      message: 'EDGE_STORE_JWT_SECRET or EDGE_STORE_SECRET_KEY is not defined',
      code: 'SERVER_ERROR',
    });
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  return await new EncryptJWT(ctx)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Date.now() / 1000 + DEFAULT_MAX_AGE)
    .setJti(uuidv4())
    .encrypt(encryptionSecret);
}

async function decryptJWT(token: string) {
  const secret =
    process.env.EDGE_STORE_JWT_SECRET ?? process.env.EDGE_STORE_SECRET_KEY;
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
  return payload;
}

async function getDerivedEncryptionKey(secret: string) {
  return await hkdf(
    'sha256',
    secret,
    '',
    'Edge Store Generated Encryption Key',
    32,
  );
}

export function buildPath(params: {
  fileInfo: RequestUploadBody['fileInfo'];
  bucket: AnyBuilder;
  pathAttrs: {
    ctx: any;
    input: any;
  };
}) {
  const { bucket } = params;
  const pathParams = bucket._def.path;
  const path = pathParams.map((param) => {
    const paramEntries = Object.entries(param);
    if (paramEntries[0] === undefined) {
      throw new EdgeStoreError({
        message: `Empty path param found in: ${JSON.stringify(pathParams)}`,
        code: 'SERVER_ERROR',
      });
    }
    const [key, value] = paramEntries[0];
    // this is a string like: "ctx.xxx" or "input.yyy.zzz"
    const currParamVal = value()
      .split('.')
      .reduce((acc2: any, key: string) => {
        if (acc2[key] === undefined) {
          throw new EdgeStoreError({
            message: `Missing key ${key} in ${JSON.stringify(acc2)}`,
            code: 'BAD_REQUEST',
          });
        }
        return acc2[key];
      }, params.pathAttrs as any) as string;
    return {
      key,
      value: currParamVal,
    };
  });
  return path;
}

export function parsePath(path: { key: string; value: string }[]) {
  const parsedPath = path.reduce<Record<string, string>>((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  const pathOrder = path.map((p) => p.key);
  return {
    parsedPath,
    pathOrder,
  };
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
  if (process.env.NODE_ENV === 'development' && url.startsWith('http://')) {
    // get the url param from the query string
    const urlParam = new URL(url).searchParams.get('url');
    if (urlParam) {
      return urlParam;
    }
  }
  return url;
}
