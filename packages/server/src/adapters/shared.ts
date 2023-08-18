import { hkdf } from '@panva/hkdf';
import { serialize } from 'cookie';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import { AnyBuilder, EdgeStoreRouter } from '../core/internals/bucketBuilder';
import EdgeStoreError from '../libs/errors/EdgeStoreError';
import { Provider } from '../providers/types';
import { IMAGE_MIME_TYPES } from './imageTypes';

// TODO: change it to 1 hour when we have a way to refresh the token
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function init<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctx: TCtx;
}) {
  const { ctx, provider, router } = params;
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
  };
};

export async function requestUpload<TCtx>(params: {
  provider: Provider;
  router: EdgeStoreRouter<TCtx>;
  ctxToken: string | undefined;
  body: RequestUploadBody;
}) {
  const {
    provider,
    router,
    ctxToken,
    body: { bucketName, input, fileInfo },
  } = params;

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  const ctx = await getContext(ctxToken);
  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new Error(`Bucket ${bucketName} not found`);
  }
  if (bucket._def.beforeUpload) {
    const canUpload = await bucket._def.beforeUpload?.({
      ctx,
      input,
      fileInfo: {
        size: fileInfo.size,
        type: fileInfo.type,
        fileName: fileInfo.fileName,
        extension: fileInfo.extension,
        replaceTargetUrl: fileInfo.replaceTargetUrl,
      },
    });
    if (!canUpload) {
      throw new Error('Upload not allowed');
    }
  }

  if (bucket._def.type === 'IMAGE') {
    if (!IMAGE_MIME_TYPES.includes(fileInfo.type)) {
      throw new EdgeStoreError({
        code: 'BAD_REQUEST',
        message: 'Only images are allowed in this bucket',
      });
    }
  }

  if (bucket._def.bucketConfig?.maxSize) {
    if (fileInfo.size > bucket._def.bucketConfig.maxSize) {
      throw new EdgeStoreError({
        code: 'BAD_REQUEST',
        message: `File size is too big. Max size is ${bucket._def.bucketConfig.maxSize}`,
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
        code: 'BAD_REQUEST',
        message: `"${
          fileInfo.type
        }" is not allowed. Accepted types are ${JSON.stringify(accept)}`,
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
  return {
    ...requestUploadRes,
    size: fileInfo.size,
    uploadedAt: new Date().toISOString(),
    path,
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
}) {
  const {
    provider,
    router,
    ctxToken,
    body: { multipart, path },
  } = params;
  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  await getContext(ctxToken); // just to check if the token is valid
  const bucket = router.buckets[multipart.uploadId];
  if (!bucket) {
    throw new Error(`Bucket ${multipart.uploadId} not found`);
  }
  return await provider.requestUploadParts({
    multipart,
    path,
  });
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
}) {
  const {
    provider,
    router,
    ctxToken,
    body: { bucketName, url },
  } = params;

  if (!ctxToken) {
    throw new EdgeStoreError({
      message: 'Missing edgestore-ctx cookie',
      code: 'UNAUTHORIZED',
    });
  }
  const ctx = await getContext(ctxToken);
  const bucket = router.buckets[bucketName];
  if (!bucket) {
    throw new Error(`Bucket ${bucketName} not found`);
  }

  if (!bucket._def.beforeDelete) {
    throw new Error(
      'You need to define beforeDelete if you want to delete files directly from the frontend.',
    );
  }

  const fileInfo = await provider.getFile({
    url,
  });
  const canDelete = await bucket._def.beforeDelete({
    ctx,
    fileInfo,
  });
  if (!canDelete) {
    throw new Error('Delete not allowed');
  }
  await provider.deleteFile({
    bucket,
    url,
  });
}

async function encryptJWT(ctx: any) {
  const secret =
    process.env.EDGE_STORE_JWT_SECRET ?? process.env.EDGE_STORE_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'EDGE_STORE_JWT_SECRET or EDGE_STORE_SECRET_KEY is not defined',
    );
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
    throw new Error(
      'EDGE_STORE_JWT_SECRET or EDGE_STORE_SECRET_KEY is not set',
    );
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

function buildPath(params: {
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
      throw new Error('Missing path param');
    }
    const [key, value] = paramEntries[0];
    // this is a string like: "ctx.xxx" or "input.yyy.zzz"
    const currParamVal = value()
      .split('.')
      .reduce((acc2: any, key: string) => {
        if (acc2[key] === undefined) {
          throw new Error(`Missing key ${key} in ${JSON.stringify(acc2)}`);
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

async function getContext(token?: string) {
  if (!token) {
    throw new Error('No token');
  }
  return await decryptJWT(token);
}
