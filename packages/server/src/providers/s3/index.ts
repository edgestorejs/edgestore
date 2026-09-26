import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { planMultipartUpload } from '@edgestore/sdk';
import {
  EdgeStoreError,
  type RequestUploadParams,
  type RequestUploadRes,
} from '@edgestore/shared';
import { z } from 'zod';
import { defineProvider } from '../../core/provider';
import { getEnv } from '../../libs/env';
import { uploadObject } from './backendUpload';
import { createObjectKeys } from './keys';
import { createMultipartUploads } from './multipart';
import { objectUploadHeaders } from './objectHeaders';
import type { S3ProviderOptions } from './options';

export type {
  S3ObjectOptions,
  S3PathFn,
  S3PathFnArgs,
  S3ProviderOptions,
} from './options';

function expiration(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 604800) {
    throw new RangeError(
      'S3 signed URL expiration must be an integer between 1 and 604800 seconds.',
    );
  }
  return value;
}

export function s3(options: S3ProviderOptions = {}) {
  const {
    credentials: configuredCredentials,
    accessKeyId = getEnv('ES_AWS_ACCESS_KEY_ID'),
    secretAccessKey = getEnv('ES_AWS_SECRET_ACCESS_KEY'),
    region = getEnv('ES_AWS_REGION'),
    bucketName = getEnv('ES_AWS_BUCKET_NAME'),
    endpoint = getEnv('ES_AWS_ENDPOINT'),
    forcePathStyle = getEnv('ES_AWS_FORCE_PATH_STYLE') === 'true',
  } = options;
  const client =
    options.client ??
    new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials:
        configuredCredentials ??
        (accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined),
      // Presigning without a body must not sign an empty-body optional checksum.
      requestChecksumCalculation: 'WHEN_REQUIRED',
    });
  const baseUrl =
    options.baseUrl ??
    getEnv('EDGE_STORE_BASE_URL') ??
    (endpoint
      ? `${endpoint.replace(/\/+$/, '')}/${bucketName}`
      : region
        ? `https://${bucketName}.s3.${region}.amazonaws.com`
        : async () =>
            `https://${bucketName}.s3.${await client.config.region()}.amazonaws.com`);
  const keys = async () =>
    createObjectKeys(typeof baseUrl === 'function' ? await baseUrl() : baseUrl);
  const uploadExpiresIn = expiration(options.uploadUrlExpiresIn ?? 3600);
  const readExpiresIn = expiration(options.signedUrlExpiresIn ?? 3600);

  function bucket() {
    if (!bucketName)
      throw new Error('S3 bucketName is not configured in S3ProviderOptions.');
    return bucketName;
  }
  function plan(sizeBytes: number) {
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0)
      throw new RangeError(
        'S3 upload size must be a nonnegative safe integer.',
      );
    const result = planMultipartUpload({
      sizeBytes,
      thresholdBytes: options.multipart?.thresholdBytes,
      preferredPartSizeBytes: options.multipart?.partSizeBytes,
      forceMultipart: sizeBytes > 5 * 1024 ** 3,
    });
    if (result && result.partSizeBytes > 5 * 1024 ** 3)
      throw new RangeError('S3 multipart parts cannot exceed 5 GiB.');
    return result;
  }
  // Validate multipart settings even before the first large upload.
  plan(0);
  const multipart = createMultipartUploads({
    client,
    bucket,
    expiresIn: uploadExpiresIn,
    audience: `edgestore:s3:${endpoint ?? region ?? 'aws'}:${bucketName}`,
    secret: () =>
      options.jwtSecret ??
      getEnv('EDGE_STORE_JWT_SECRET') ??
      getEnv('EDGE_STORE_SECRET_KEY'),
  });

  async function prepare({
    bucketName: logicalBucket,
    fileInfo,
  }: RequestUploadParams) {
    const physicalBucket = bucket();
    if (fileInfo.temporary || fileInfo.replaceTargetUrl) {
      throw new EdgeStoreError({
        code: 'BAD_REQUEST',
        message:
          'S3 does not support temporary uploads or replaceTargetUrl. Use unique keys and manage file cleanup in your application.',
      });
    }
    const objectKeys = await keys();
    const extension = fileInfo.extension
      ? `.${fileInfo.extension.replace(/^\./, '')}`
      : '';
    const defaultPath = [
      ...(fileInfo.isPublic ? ['_public'] : []),
      ...fileInfo.path.map((part) => part.value),
      fileInfo.fileName ?? `${crypto.randomUUID()}${extension}`,
    ].join('/');
    const args = { edgestoreBucketName: logicalBucket, fileInfo, defaultPath };
    const relativePath = objectKeys.normalizeRelativePath(
      options.path ? await options.path(args) : defaultPath,
    );
    const key = `${logicalBucket}/${relativePath}`;
    const objectOptions =
      typeof options.objectOptions === 'function'
        ? await options.objectOptions(args)
        : options.objectOptions;
    const input: PutObjectCommandInput = {
      ...objectOptions,
      Bucket: physicalBucket,
      Key: key,
      ContentLength: fileInfo.size,
      ContentType: fileInfo.type || 'application/octet-stream',
    };
    return {
      input,
      key,
      url: objectKeys.toUrl(key),
      plan: plan(fileInfo.size),
    };
  }

  async function signedRead(key: string, expiresIn = readExpiresIn) {
    const ttl = expiration(expiresIn);
    const signedUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: ttl },
    );
    return {
      url: (await keys()).toUrl(key),
      signedUrl,
      expiresAt: new Date(Date.now() + ttl * 1000),
      expiresIn: ttl,
    };
  }
  async function readForUpload(key: string, params: RequestUploadParams) {
    if (params.fileInfo.isPublic || !params.autoSignedUrls) return undefined;
    return signedRead(key, params.autoSignedUrls.expiresIn);
  }

  return defineProvider({
    name: 's3',
    disableDevProxy: true,
    baseUrl,
    reference: {
      schema: z.union([
        z.object({ key: z.string().min(1) }),
        z.object({ url: z.string().url() }),
      ]),
      fromUrl: (url) => ({ url }),
    },
    async init({ router }) {
      bucket();
      for (const logicalBucket of Object.values(router.buckets)) {
        if (
          logicalBucket._def.accessControl !== undefined &&
          logicalBucket._def.accessControl !== 'private'
        ) {
          throw new Error(
            'S3 supports accessControl("private") with backend signed URLs, not cookie-based access-control rules.',
          );
        }
      }
      return {};
    },
    uploads: {
      async request(params): Promise<RequestUploadRes> {
        const checksumPolicy = options.client
          ? await client.config.requestChecksumCalculation?.()
          : undefined;
        if (checksumPolicy && checksumPolicy !== 'WHEN_REQUIRED') {
          throw new Error(
            'An injected S3 client must use requestChecksumCalculation: "WHEN_REQUIRED" for browser uploads.',
          );
        }
        const prepared = await prepare(params);
        const read = await readForUpload(prepared.key, params);
        const access = {
          key: prepared.key,
          accessUrl: prepared.url,
          ...(read
            ? {
                accessSignedUrl: read.signedUrl,
                accessSignedUrlExpiresAt: read.expiresAt,
                accessSignedUrlExpiresIn: read.expiresIn,
              }
            : {}),
        };
        if (prepared.plan) {
          return {
            ...access,
            multipart: await multipart.request(prepared.input, prepared.plan),
          };
        }
        const uploadHeaders = objectUploadHeaders(prepared.input);
        return {
          ...access,
          uploadUrl: await getSignedUrl(
            client,
            new PutObjectCommand(prepared.input),
            {
              expiresIn: uploadExpiresIn,
              signableHeaders: new Set(['content-type']),
              unhoistableHeaders: new Set(
                Object.keys(uploadHeaders).map((name) => name.toLowerCase()),
              ),
            },
          ),
          uploadHeaders,
        };
      },
      multipart: multipart.operations,
      async upload(params) {
        const prepared = await prepare({
          ...params,
          fileInfo: {
            ...params.fileInfo,
            size: params.source.size,
            type: params.source.type || params.fileInfo.type,
          },
        });
        // Validate signed URL settings before sending bytes.
        if (params.autoSignedUrls?.expiresIn !== undefined)
          expiration(params.autoSignedUrls.expiresIn);
        await uploadObject({
          client,
          input: prepared.input,
          plan: prepared.plan,
          source: params.source,
          signal: params.signal,
          onProgress: params.onProgress,
        });
        const { ContentLength, LastModified } = await client.send(
          new HeadObjectCommand({ Bucket: bucket(), Key: prepared.key }),
          { abortSignal: params.signal },
        );
        if (ContentLength === undefined || !LastModified)
          throw new Error('File not found');
        return {
          file: {
            key: prepared.key,
            url: prepared.url,
            sizeBytes: ContentLength,
            uploadedAt: LastModified,
            updatedAt: LastModified,
          },
          signedReadUrl: await readForUpload(prepared.key, params),
        };
      },
    },
    files: {
      async get({ bucketName: logicalBucket, file }) {
        const objectKeys = await keys();
        const key = objectKeys.fromReference(logicalBucket, file);
        const { ContentLength, LastModified } = await client.send(
          new HeadObjectCommand({ Bucket: bucket(), Key: key }),
        );
        if (ContentLength === undefined || !LastModified)
          throw new Error('File not found');
        return {
          key,
          url: objectKeys.toUrl(key),
          sizeBytes: ContentLength,
          uploadedAt: LastModified,
          updatedAt: LastModified,
        };
      },
      async getSignedUrls({ bucketName: logicalBucket, files, expiresIn }) {
        const objectKeys = await keys();
        const objectKeysToSign = files.map((file) =>
          objectKeys.fromReference(logicalBucket, file),
        );
        return Promise.all(
          objectKeysToSign.map((key) => signedRead(key, expiresIn)),
        );
      },
      async delete({ bucketName: logicalBucket, files }) {
        bucket();
        const objectKeys = await keys();
        const paths = files.map((file) =>
          objectKeys.fromReference(logicalBucket, file),
        );
        const results = [];
        // Bounded requests avoid flooding the S3 client for large batches.
        for (const key of paths) {
          try {
            await client.send(
              new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
            );
            results.push({ success: true as const });
          } catch (error) {
            results.push({
              success: false as const,
              error: {
                code: 'DELETE_FAILED' as const,
                message:
                  error instanceof Error ? error.message : 'Delete failed',
              },
            });
          }
        }
        return { results };
      },
    },
  });
}
