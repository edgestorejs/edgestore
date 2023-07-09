import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Provider } from "./types";
import { v4 as uuidv4 } from "uuid";

export type AWSProviderOptions = {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
};

export function AWSProvider(options?: AWSProviderOptions): Provider {
  const {
    accessKeyId = process.env.ES_AWS_ACCESS_KEY_ID,
    secretAccessKey = process.env.ES_AWS_SECRET_ACCESS_KEY,
    region = process.env.ES_AWS_REGION,
    bucketName = process.env.ES_AWS_BUCKET_NAME,
  } = options || {};

  const credentials =
    accessKeyId && secretAccessKey
      ? {
          accessKeyId,
          secretAccessKey,
        }
      : undefined;
  const s3Client = new S3Client({ region, credentials });

  const baseUrl =
    process.env.EDGE_STORE_BASE_URL ||
    `https://${bucketName}.s3.${region}.amazonaws.com`;

  return {
    async init(ctx) {
      return {};
    },
    getBaseUrl() {
      return baseUrl;
    },
    async requestUpload({ fileInfo }) {
      const pathPrefix = `${fileInfo.routeName}${
        fileInfo.isPublic ? "/_public" : ""
      }`;
      const nameId = uuidv4();
      const extension = fileInfo.extension
        ? `.${fileInfo.extension.replace(".", "")}`
        : "";
      const fileName = `${nameId}${extension}`;
      const filePath = fileInfo.path.reduce((acc, item) => {
        return `${acc}/${item.value}`;
      }, "");

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
  };
}
