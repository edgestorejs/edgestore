import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { planMultipartUpload } from '@edgestore/sdk';
import {
  type RequestUploadParams,
  type RequestUploadRes,
} from '@edgestore/shared';
import { z } from 'zod';
import { defineProvider } from '../../core/provider';
import { getEnv } from '../../libs/env';
import { createMultipartSessions } from '../storage/multipartSession';
import { createObjectKeys } from '../storage/objectKeys';
import {
  assertSignedUrlAccessControl,
  signedUrlLifetime,
} from '../storage/transfer';
import { uploadObject } from './backendUpload';
import { createMultipartUploads } from './multipart';
import { objectUploadHeaders } from './objectHeaders';
import type { S3ProviderOptions } from './options';

export type {
  S3ObjectOptions,
  S3PathFn,
  S3PathFnArgs,
  S3ProviderOptions,
} from './options';

const expiration = (value: number) => signedUrlLifetime('S3', value);

export function s3(options: S3ProviderOptions = {}) {
  const {
    credentials: configuredCredentials,
    region = getEnv('ES_AWS_REGION'),
    bucketName = getEnv('ES_AWS_BUCKET_NAME'),
    endpoint = getEnv('ES_AWS_ENDPOINT'),
    forcePathStyle = getEnv('ES_AWS_FORCE_PATH_STYLE') === 'true',
  } = options;
  const accessKeyId = getEnv('ES_AWS_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('ES_AWS_SECRET_ACCESS_KEY');
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
    getEnv('EDGESTORE_BASE_URL') ??
    (endpoint
      ? `${endpoint.replace(/\/+$/, '')}/${bucketName}`
      : region
        ? `https://${bucketName}.s3.${region}.amazonaws.com`
        : async () =>
            `https://${bucketName}.s3.${await client.config.region()}.amazonaws.com`);
  const keys = async () =>
    createObjectKeys(
      'S3',
      typeof baseUrl === 'function' ? await baseUrl() : baseUrl,
    );
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
    partUrlExpiresIn: uploadExpiresIn,
    sessions: createMultipartSessions({
      providerName: 'S3',
      audience: `edgestore:s3:${endpoint ?? region ?? 'aws'}:${bucketName}`,
      secret: options.jwtSecret,
      expiresIn: options.multipart?.sessionExpiresIn ?? 86400,
    }),
  });

  async function prepare({
    bucketName: logicalBucket,
    fileInfo,
  }: RequestUploadParams) {
    const physicalBucket = bucket();
    const objectKeys = await keys();
    const { key, pathArgs } = await objectKeys.forUpload(
      logicalBucket,
      fileInfo,
      options.path,
    );
    const objectOptions =
      typeof options.objectOptions === 'function'
        ? await options.objectOptions(pathArgs)
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
  // Presigned browser uploads must not sign a checksum of the empty body.
  let presignable: Promise<void> | undefined;
  function assertPresignableClient() {
    return (presignable ??= (async () => {
      const policy = options.client
        ? await client.config.requestChecksumCalculation?.()
        : undefined;
      if (policy && policy !== 'WHEN_REQUIRED') {
        throw new Error(
          'An injected S3 client must use requestChecksumCalculation: "WHEN_REQUIRED" for browser uploads.',
        );
      }
    })());
  }

  async function readForUpload(key: string, params: RequestUploadParams) {
    if (params.fileInfo.isPublic || !params.autoSignedUrls) return undefined;
    return signedRead(key, params.autoSignedUrls.expiresIn);
  }

  return defineProvider({
    name: 's3',
    reference: {
      schema: z.union([
        z.object({ key: z.string().min(1) }),
        z.object({ url: z.string().url() }),
      ]),
      fromUrl: (url) => ({ url }),
    },
    async init({ router }) {
      bucket();
      assertSignedUrlAccessControl('S3', router);
      return {};
    },
    uploads: {
      supportedOptions: { temporary: false, replaceTargetUrl: false },
      async request(params): Promise<RequestUploadRes> {
        await assertPresignableClient();
        const prepared = await prepare(params);
        const read = await readForUpload(prepared.key, params);
        const access = {
          key: prepared.key,
          url: prepared.url,
          ...(read
            ? {
                signedReadUrl: {
                  signedUrl: read.signedUrl,
                  expiresAt: read.expiresAt,
                  expiresIn: read.expiresIn,
                },
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
        // Sign the read URL before sending bytes: nothing fallible may run
        // after the object is committed.
        const signedReadUrl = await readForUpload(prepared.key, params);
        await uploadObject({
          client,
          input: prepared.input,
          plan: prepared.plan,
          source: params.source,
          signal: params.signal,
          onProgress: params.onProgress,
        });
        // The object is committed. Describe it from what we sent, so a failed
        // or canceled follow-up request cannot turn success into an error.
        const uploadedAt = new Date();
        return {
          file: {
            key: prepared.key,
            url: prepared.url,
            sizeBytes: params.source.size,
            uploadedAt,
            updatedAt: uploadedAt,
          },
          signedReadUrl,
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
        const physicalBucket = bucket();
        const objectKeys = await keys();
        const paths = files.map((file) =>
          objectKeys.fromReference(logicalBucket, file),
        );
        const results = [];
        // DeleteObjects accepts up to 1,000 keys per request.
        for (let start = 0; start < paths.length; start += 1000) {
          const batch = paths.slice(start, start + 1000);
          const errors = new Map<string, string>();
          try {
            const { Errors } = await client.send(
              new DeleteObjectsCommand({
                Bucket: physicalBucket,
                Delete: {
                  Objects: [...new Set(batch)].map((Key) => ({ Key })),
                  Quiet: true,
                },
              }),
            );
            for (const error of Errors ?? []) {
              if (error.Key)
                errors.set(error.Key, error.Message ?? 'Delete failed');
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Delete failed';
            for (const key of batch) errors.set(key, message);
          }
          for (const key of batch) {
            const message = errors.get(key);
            results.push(
              message === undefined
                ? { success: true as const }
                : {
                    success: false as const,
                    error: { code: 'DELETE_FAILED' as const, message },
                  },
            );
          }
        }
        return { results };
      },
    },
  });
}
