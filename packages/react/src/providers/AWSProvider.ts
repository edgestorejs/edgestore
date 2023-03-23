import {
  PutObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Provider } from "./types";
import { v4 as uuidv4 } from "uuid";
import { NextApiRequest, NextApiResponse } from "next";
import { EncryptJWT, jwtDecrypt } from "jose";
import { hkdf } from "@panva/hkdf";
import { serialize } from "cookie";

const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60;

export type AWSProviderOptions<
  C extends Record<string, unknown> = Record<string, unknown>
> = {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
  bucketName?: string;
  createContext?: (params: {
    req: NextApiRequest;
    res: NextApiResponse;
  }) => C | Promise<C>;
  onRequestUpload?: (params: {
    req: NextApiRequest;
    res: NextApiResponse;
    ctx: C;
  }) => void | Promise<void>;
  pathPrefix?: (params: {
    req: NextApiRequest;
    res: NextApiResponse;
    ctx: C;
  }) => string | Promise<string>;
};

export default function AWSProvider<
  C extends Record<string, unknown> = Record<string, unknown>
>(options?: AWSProviderOptions<C>): Provider {
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
      const ctx = options?.createContext
        ? await options.createContext({ req, res })
        : ({} as C);
      const token = await encryptJWT(ctx);

      res.setHeader(
        "Set-Cookie",
        serialize("edgestore", token, {
          path: "/",
          maxAge: DEFAULT_MAX_AGE,
        })
      );

      res.json({
        token,
        baseUrl,
      });
    },
    requestUpload: async (req, res) => {
      console.log("requestUpload", req.body);

      const ctx = await getContext<C>(req);
      const pathPrefix = options?.pathPrefix
        ? await options.pathPrefix({ req, res, ctx })
        : "";

      const fileName =
        req.body.name ?? `${uuidv4()}.${req.body.extension.replace(".", "")}`;
      const filePath = pathPrefix + (req.body.path ?? "/"); // TODO: handle public path
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
      if (options?.onRequestUpload) {
        await options.onRequestUpload({ req, res, ctx });
      }

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

async function encryptJWT(ctx: Record<string, unknown>) {
  const secret = process.env.ES_SECRET;
  if (!secret) {
    throw new Error("ES_SECRET is not defined");
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  return await new EncryptJWT(ctx)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Date.now() / 1000 + DEFAULT_MAX_AGE)
    .setJti(uuidv4())
    .encrypt(encryptionSecret);
}

async function decryptJWT(token: string) {
  const secret = process.env.ES_SECRET;
  if (!secret) {
    throw new Error("ES_SECRET is not defined");
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  const { payload } = await jwtDecrypt(token, encryptionSecret, {
    clockTolerance: 15,
  });
  return payload;
}

async function getDerivedEncryptionKey(secret: string) {
  return await hkdf(
    "sha256",
    secret,
    "",
    "Edge Store Generated Encryption Key",
    32
  );
}

async function getContext<
  C extends Record<string, unknown> = Record<string, unknown>
>(req: NextApiRequest) {
  const token = req.cookies.edgestore;
  if (!token) {
    return {} as C;
  }
  return (await decryptJWT(token)) as C;
}
