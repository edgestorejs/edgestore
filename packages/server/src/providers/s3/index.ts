import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type MaybePromise, type RequestUploadParams } from '@edgestore/shared';
import { z } from 'zod';
import { defineProvider } from '../../core/provider';
import { getEnv } from '../../libs/env';

// FileInfo type as received by the provider's requestUpload, part of RequestUploadParams
type ProviderUploadedFileInfo = RequestUploadParams['fileInfo'];

export type S3PathFnArgs = {
  /** Logical EdgeStore router bucket name. */
  edgestoreBucketName: string;
  /** File info after EdgeStore path and metadata generation. */
  fileInfo: ProviderUploadedFileInfo;
  /** Default object path relative to the logical bucket prefix. */
  defaultPath: string;
};

export type S3PathFn = (args: S3PathFnArgs) => MaybePromise<string>;

export type S3ProviderOptions = {
  /**
   * AWS SDK credentials (or credentials provider) to use for S3 requests.
   *
   * If unset, the AWS SDK will use its default credential provider chain
   * (environment variables, shared config files, instance/task roles, etc).
   */
  credentials?: S3ClientConfig['credentials'];
  /**
   * Access key for AWS credentials.
   * Can also be set via the `ES_AWS_ACCESS_KEY_ID` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   *
   * @deprecated Pass `credentials` instead.
   */
  accessKeyId?: string;
  /**
   * Secret access key for AWS credentials.
   * Can also be set via the `ES_AWS_SECRET_ACCESS_KEY` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   *
   * @deprecated Pass `credentials` instead.
   */
  secretAccessKey?: string;
  /**
   * AWS region to use.
   * Can also be set via the `ES_AWS_REGION` environment variable.
   */
  region?: string;
  /**
   * Name of the S3 bucket to use.
   * Can also be set via the `ES_AWS_BUCKET_NAME` environment variable.
   */
  bucketName?: string;
  /**
   * Custom endpoint for S3-compatible storage providers (e.g., MinIO).
   * Can also be set via the `ES_AWS_ENDPOINT` environment variable.
   */
  endpoint?: string;
  /**
   * Force path style for S3-compatible storage providers.
   * Can also be set via the `ES_AWS_FORCE_PATH_STYLE` environment variable.
   * Defaults to false for AWS S3, but should be true for most S3-compatible providers.
   */
  forcePathStyle?: boolean;
  /**
   * Base URL to use for accessing files.
   * Only needed if you are using a custom domain or cloudfront.
   *
   * It can also be set via the `EDGE_STORE_BASE_URL` environment variable.
   */
  baseUrl?: string;
  /**
   * Secret to use for encrypting JWT tokens.
   * Can be generated with `openssl rand -base64 32`.
   *
   * It can also be set via the `EDGE_STORE_JWT_SECRET` environment variable.
   */
  jwtSecret?: string;
  /**
   * Customizes the object path beneath the logical EdgeStore bucket prefix.
   *
   * The logical bucket prefix is always preserved so router authorization for
   * one bucket cannot access objects from another.
   */
  path?: S3PathFn;
};

export function s3(options?: S3ProviderOptions) {
  const {
    credentials: credentialsFromOptions,
    accessKeyId = getEnv('ES_AWS_ACCESS_KEY_ID'),
    secretAccessKey = getEnv('ES_AWS_SECRET_ACCESS_KEY'),
    region = getEnv('ES_AWS_REGION'),
    bucketName = getEnv('ES_AWS_BUCKET_NAME'),
    endpoint = getEnv('ES_AWS_ENDPOINT'),
    forcePathStyle = getEnv('ES_AWS_FORCE_PATH_STYLE') === 'true',
    path: resolvePath,
  } = options ?? {};

  const baseUrl =
    options?.baseUrl ??
    getEnv('EDGE_STORE_BASE_URL') ??
    (endpoint
      ? `${endpoint}/${bucketName}`
      : `https://${bucketName}.s3.${region}.amazonaws.com`);

  const credentials =
    credentialsFromOptions ??
    (accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined);
  const s3Client = new S3Client({
    region,
    credentials,
    endpoint,
    forcePathStyle,
  });
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  function objectKeyToUrl(objectKey: string) {
    const encodedKey = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${normalizedBaseUrl}/${encodedKey}`;
  }

  function urlToObjectKey(edgestoreBucketName: string, url: string) {
    let objectKey: string;
    try {
      const fileUrl = new URL(url);
      const providerUrl = new URL(`${normalizedBaseUrl}/`);
      if (
        fileUrl.origin !== providerUrl.origin ||
        !fileUrl.pathname.startsWith(providerUrl.pathname)
      ) {
        throw new Error();
      }
      objectKey = decodeURIComponent(
        fileUrl.pathname.slice(providerUrl.pathname.length),
      );
    } catch {
      throw new Error('File URL does not belong to this S3 provider.');
    }

    if (!objectKey.startsWith(`${edgestoreBucketName}/`)) {
      throw new Error(
        `File does not belong to EdgeStore bucket "${edgestoreBucketName}".`,
      );
    }
    return objectKey;
  }

  function normalizeRelativePath(value: string) {
    const path = value.replace(/^\/+|\/+$/g, '');
    if (
      path.length === 0 ||
      path.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error('S3 paths must stay within the EdgeStore bucket prefix.');
    }
    return path;
  }

  return defineProvider({
    name: 's3',
    baseUrl,
    reference: {
      schema: z.object({ url: z.string() }),
      fromUrl: (url) => ({ url }),
    },
    async init() {
      return {};
    },
    uploads: {
      async request(params: RequestUploadParams) {
        const { bucketName: esBucketName, fileInfo } = params;

        if (!bucketName) {
          throw new Error(
            'S3 bucketName is not configured in S3ProviderOptions.',
          );
        }

        const extension = fileInfo.extension
          ? `.${fileInfo.extension.replace('.', '')}`
          : '';
        const defaultResolvedFileName =
          fileInfo.fileName ?? `${crypto.randomUUID()}${extension}`;
        const defaultPath = [
          ...(fileInfo.isPublic ? ['_public'] : []),
          ...fileInfo.path.map((item) => item.value),
          defaultResolvedFileName,
        ].join('/');

        const relativePath = normalizeRelativePath(
          resolvePath
            ? await resolvePath({
                edgestoreBucketName: esBucketName,
                fileInfo,
                defaultPath,
              })
            : defaultPath,
        );
        const accessPath = `${esBucketName}/${relativePath}`;

        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: accessPath,
        });
        const signedUrl = await getSignedUrl(s3Client, command, {
          expiresIn: 60 * 60,
        });
        return {
          uploadUrl: signedUrl,
          accessUrl: objectKeyToUrl(accessPath),
        };
      },
    },
    files: {
      async get({ bucketName: edgestoreBucketName, file }) {
        const path = urlToObjectKey(edgestoreBucketName, file.url);
        const { ContentLength, LastModified } = await s3Client.send(
          new HeadObjectCommand({
            Bucket: bucketName,
            Key: path,
          }),
        );

        if (ContentLength === undefined || !LastModified) {
          throw new Error('File not found');
        }

        return {
          url: file.url,
          sizeBytes: ContentLength,
          uploadedAt: LastModified,
          updatedAt: LastModified,
        };
      },
      async delete({ bucketName: edgestoreBucketName, files }) {
        if (!bucketName) {
          throw new Error(
            'S3 bucketName is not configured in S3ProviderOptions for deleteFile.',
          );
        }
        const objectKeys = files.map((file) =>
          urlToObjectKey(edgestoreBucketName, file.url),
        );
        const results = await Promise.all(
          objectKeys.map(async (objectKey) => {
            try {
              await s3Client.send(
                new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: objectKey,
                }),
              );
              return { success: true as const };
            } catch (error) {
              return {
                success: false as const,
                error: {
                  code: 'DELETE_FAILED' as const,
                  message:
                    error instanceof Error ? error.message : 'Delete failed',
                },
              };
            }
          }),
        );
        return { results };
      },
    },
  });
}
