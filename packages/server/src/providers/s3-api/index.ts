import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type Provider } from '@edgestore/shared';
import { v4 as uuidv4 } from 'uuid';

export type S3APIProviderOptions = {
  /**
   * Access key for S3 Storage compatible credentials.
   * Can also be set via the `ES_S3API_ACCESS_KEY_ID` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  accessKeyId?: string;
  /**
   * Secret access key for S3 Storage compatible credentials.
   * Can also be set via the `ES_S3API_SECRET_ACCESS_KEY` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  secretAccessKey?: string;
  /**
   * S3 Storage compatible region to use.
   * Can also be set via the `ES_S3API_REGION` environment variable.
   */
  region?: string;
  /**
   * Name of the S3 Storage compatible bucket to use.
   * Can also be set via the `ES_S3API_BUCKET_NAME` environment variable.
   */
  bucketName?: string;
  /**
   * Custom endpoint to use for S3 Storage compatible API.
   * Can also be set via the `ES_S3API_ENDPOINT` environment variable.
   */
  endpoint?: string;
  /**
   * Base URL to use for accessing files.
   * Only needed if you are using a custom domain or cloudfront.
   *
   * Can also be set via the `EDGE_STORE_PUBLIC_URL` environment variable.
  */
  publicUrl?: string;
  /**
   * Secret to use for encrypting JWT tokens.
   * Can be generated with `openssl rand -base64 32`.
   *
   * Can also be set via the `EDGE_STORE_JWT_SECRET` environment variable.
   */
  jwtSecret?: string;
};

export function S3APIProvider(options?: S3APIProviderOptions): Provider {
  const {
    accessKeyId = process.env.ES_S3API_ACCESS_KEY_ID,
    secretAccessKey = process.env.ES_S3API_SECRET_ACCESS_KEY,
    region = process.env.ES_S3API_REGION,
    bucketName = process.env.ES_S3API_BUCKET_NAME,
    endpoint = process.env.ES_S3API_ENDPOINT,
  } = options ?? {};

  const baseUrl = options?.publicUrl ?? process.env.EDGE_STORE_PUBLIC_URL ?? `${endpoint}`;

  const credentials =
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined;
  const s3Client = new S3Client({ endpoint, region, credentials });

  return {
    async init() {
      return {};
    },
    getBaseUrl() {
      return baseUrl;
    },
    async getFile({ url }) {
      const path = url.replace(`${baseUrl}/`, '');
      const { ContentLength, LastModified } = await s3Client.send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: path,
        }),
      );

      if (!ContentLength || !LastModified) {
        throw new Error('File not found');
      }

      return {
        url,
        metadata: {},
        path: {},
        size: ContentLength,
        uploadedAt: LastModified,
      };
    },
    async requestUpload({ bucketName: esBucketName, fileInfo }) {
      const pathPrefix = `${esBucketName}${
        fileInfo.isPublic ? '/_public' : ''
      }`;
      const nameId = uuidv4();
      const extension = fileInfo.extension
        ? `.${fileInfo.extension.replace('.', '')}`
        : '';
      const fileName = fileInfo.fileName ?? `${nameId}${extension}`;
      const filePath = fileInfo.path.reduce((acc, item) => {
        return `${acc}/${item.value}`;
      }, '');
      const accessPath = `${pathPrefix}${filePath}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: accessPath,
      });

      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 60 * 60, // 1 hour
      });

      const url = `${baseUrl}/${accessPath}`;
      return {
        uploadUrl: signedUrl,
        accessUrl: url,
      };
    },
    async requestUploadParts() {
      throw new Error('Not implemented');
    },
    async completeMultipartUpload() {
      throw new Error('Not implemented');
    },
    async confirmUpload() {
      throw new Error('Not implemented');
    },
    async deleteFile({ url }) {
      const path = url.replace(`${baseUrl}/`, '');
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: bucketName,
          Key: path,
        }),
      );
      return {
        success: true,
      };
    },
  };
}
