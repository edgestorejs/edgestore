import type {
  PutObjectCommandInput,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import type { MaybePromise, RequestUploadParams } from '@edgestore/shared';

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
   * Secret used to sign multipart upload sessions. The adapter context cookie
   * still requires EDGE_STORE_JWT_SECRET (or EDGE_STORE_SECRET_KEY).
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
  /** An existing client, for custom retry, transport, or endpoint configuration.
   * Browser uploads require requestChecksumCalculation: "WHEN_REQUIRED".
   * Set baseUrl when this client uses a custom endpoint. */
  client?: S3Client;
  /** Presigned upload URL lifetime in seconds. Default: 3600. */
  uploadUrlExpiresIn?: number;
  /** Presigned download URL lifetime in seconds. Default: 3600. */
  signedUrlExpiresIn?: number;
  /** Automatic multipart upload configuration. Defaults: 100 MiB / 16 MiB. */
  multipart?: { thresholdBytes?: number; partSizeBytes?: number };
  /** Object settings shared by browser and backend uploads. */
  objectOptions?:
    S3ObjectOptions | ((args: S3PathFnArgs) => MaybePromise<S3ObjectOptions>);
};
