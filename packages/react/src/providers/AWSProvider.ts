import { Provider } from "./types";

export type AWSProviderOptions = {
  accessKey?: string;
  secretKey?: string;
  region?: string;
  bucketName?: string;
};

export default function AWSProvider(options?: AWSProviderOptions): Provider {
  const {
    accessKey = process.env.ES_AWS_ACCESS_KEY_ID,
    secretKey = process.env.ES_AWS_SECRET_ACCESS_KEY,
    region = process.env.ES_AWS_REGION,
    bucketName = process.env.ES_AWS_BUCKET_NAME,
  } = options || {};
  return {
    init: async (req, res) => {
      res.json({
        token: "TODO",
        baseUrl: "TODO",
      });
    },
    requestUpload: async (req, res) => {
      // TODO: Implement
      res.json({
        signedUrl: "TODO",
        url: "TODO",
        path: "TODO",
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
