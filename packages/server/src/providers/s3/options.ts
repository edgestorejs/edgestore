import type {
  PutObjectCommandInput,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import type { MaybePromise } from '@edgestore/shared';
import type { ObjectPathFn, ObjectPathFnArgs } from '../storage/objectKeys';

export type S3ObjectOptions = Pick<
  PutObjectCommandInput,
  | 'CacheControl'
  | 'ContentDisposition'
  | 'Metadata'
  | 'Tagging'
  | 'StorageClass'
  | 'ServerSideEncryption'
  | 'SSEKMSKeyId'
>;

/** Arguments passed to the `path` callback. */
export type S3PathFnArgs = ObjectPathFnArgs;

/** Returns an object path relative to the logical bucket prefix. */
export type S3PathFn = ObjectPathFn;

export type S3ProviderOptions = {
  /**
   * AWS SDK credentials (or credentials provider) to use for S3 requests.
   *
   * If unset, `ES_AWS_ACCESS_KEY_ID` and `ES_AWS_SECRET_ACCESS_KEY` are used
   * when both are set. Otherwise the AWS SDK uses its default credential
   * provider chain (environment variables, shared config files, instance/task
   * roles, etc).
   */
  credentials?: S3ClientConfig['credentials'];
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
   * It can also be set via the `EDGESTORE_BASE_URL` environment variable.
   */
  baseUrl?: string;
  /**
   * Secret used to sign multipart upload sessions. The adapter context cookie
   * still requires EDGESTORE_JWT_SECRET (or EDGESTORE_SECRET_KEY).
   * Can be generated with `openssl rand -base64 32`.
   *
   * It can also be set via the `EDGESTORE_JWT_SECRET` environment variable.
   */
  jwtSecret?: string;
  /**
   * Customizes the object path beneath the logical EdgeStore bucket prefix.
   *
   * The logical bucket prefix is always preserved so router authorization for
   * one bucket cannot access objects from another.
   */
  path?: S3PathFn;
  /** An existing client, for custom retry, transport, or endpoint configuration.
   * Browser uploads require requestChecksumCalculation: "WHEN_REQUIRED".
   * Set baseUrl when this client uses a custom endpoint. */
  client?: S3Client;
  /** Presigned upload URL lifetime in seconds. Default: 3600. */
  uploadUrlExpiresIn?: number;
  /** Presigned download URL lifetime in seconds. Default: 3600. */
  signedUrlExpiresIn?: number;
  /** Automatic multipart upload configuration. */
  multipart?: {
    /** Size above which uploads use multipart transfers. Default: 100 MiB. */
    thresholdBytes?: number;
    /** Preferred part size. Default: 16 MiB. */
    partSizeBytes?: number;
    /**
     * How long a browser multipart session can request part URLs, complete, or
     * abort, in seconds. Default: 86400 (24 hours).
     */
    sessionExpiresIn?: number;
  };
  /** Object settings shared by browser and backend uploads. */
  objectOptions?:
    S3ObjectOptions | ((args: S3PathFnArgs) => MaybePromise<S3ObjectOptions>);
};
