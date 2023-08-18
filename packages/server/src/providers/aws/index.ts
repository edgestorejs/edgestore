import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Provider } from '../types';

export type AWSProviderOptions = {
  /**
   * Access key for AWS credentials.
   * Can also be set via the `ES_AWS_ACCESS_KEY_ID` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
   */
  accessKeyId?: string;
  /**
   * Secret access key for AWS credentials.
   * Can also be set via the `ES_AWS_SECRET_ACCESS_KEY` environment variable.
   *
   * If unset, the SDK will attempt to use the default credentials provider chain.
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
   * Base URL to use for accessing files.
   * Only needed if you are using a custom domain or cloudfront.
   *
   * Can also be set via the `EDGE_STORE_BASE_URL` environment variable.
   */
  baseUrl?: string;
};

export function AWSProvider(options?: AWSProviderOptions): Provider {
  const {
    accessKeyId = process.env.ES_AWS_ACCESS_KEY_ID,
    secretAccessKey = process.env.ES_AWS_SECRET_ACCESS_KEY,
    region = process.env.ES_AWS_REGION,
    bucketName = process.env.ES_AWS_BUCKET_NAME,
  } = options ?? {};

  const baseUrl =
    options?.baseUrl ??
    process.env.EDGE_STORE_BASE_URL ??
    `https://${bucketName}.s3.${region}.amazonaws.com`;

  const credentials =
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined;
  const s3Client = new S3Client({ region, credentials });

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
    async requestUpload({ bucketName, fileInfo }) {
      const pathPrefix = `${bucketName}${fileInfo.isPublic ? '/_public' : ''}`;
      const nameId = uuidv4();
      const extension = fileInfo.extension
        ? `.${fileInfo.extension.replace('.', '')}`
        : '';
      const fileName = `${nameId}${extension}`;
      const filePath = fileInfo.path.reduce((acc, item) => {
        return `${acc}/${item.value}`;
      }, '');

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `${pathPrefix}/${filePath}/${fileName}`,
      });

      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 60 * 60, // 1 hour
      });

      const url = `${baseUrl}/${fileInfo.path}`;
      return {
        uploadUrl: signedUrl,
        accessUrl: url,
      };
    },
    async requestUploadParts() {
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
