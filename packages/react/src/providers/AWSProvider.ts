import {
  PutObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Provider } from "./types";
import { v4 as uuidv4 } from "uuid";

export type AWSProviderOptions = {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
};

export default function AWSProvider(options?: AWSProviderOptions): Provider {
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
    init: async (req, res) => {
      res.json({
        token: "TODO",
        baseUrl,
      });
    },
    requestUpload: async (req, res) => {
      console.log("requestUpload", req.body);
      const fileName =
        req.body.name ?? `${uuidv4()}.${req.body.extension.replace(".", "")}`;
      const filePath = req.body.path ?? "/"; // TODO: handle public path
      const fileKey = `${filePath}${fileName}`.replace(/^\//, "");

      if (!req.body.overwrite) {
        // check if file already exists
        const command = new HeadObjectCommand({
          Bucket: bucketName,
          Key: fileKey,
        });

        try {
          await s3Client.send(command);
          throw new Error("File already exists");
        } catch {
          // file does not exist, continue
        }
      }
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        ContentType: getMimeType(req.body.extension),
      });

      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 60 * 60, // 1 hour
      });

      const url = `${baseUrl}/${fileKey}`;
      res.json({
        signedUrl,
        url,
        path: "/" + fileKey,
      });
    },
    requestAccess: (req, res) => {
      // TODO: Implement
      res.json({
        success: true,
      });
    },
  };
}

const getMimeType = (extension: string) => {
  const parsedExtension = extension.toLowerCase().replace(".", "");
  switch (parsedExtension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
};
