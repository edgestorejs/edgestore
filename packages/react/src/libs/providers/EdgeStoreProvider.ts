import { serialize } from "cookie";
import { Provider } from "./types";

const API_ENDPOINT =
  process.env.EDGE_STORE_API_ENDPOINT || "https://api.edge-store.com";
const DEFAULT_BASE_URL =
  process.env.EDGE_STORE_BASE_URL || "https://files.edge-store.com";

export type EdgeStoreProviderOptions = {
  accessKey?: string;
  secretKey?: string;
  baseUrl?: string;
};

export default function EdgeStoreProvider(
  options?: EdgeStoreProviderOptions
): Provider {
  const {
    accessKey = process.env.EDGE_STORE_ACCESS_KEY,
    secretKey = process.env.EDGE_STORE_SECRET_KEY,
    baseUrl = process.env.EDGE_STORE_BASE_URL || DEFAULT_BASE_URL,
  } = options || {};
  return {
    init: async (req, res) => {
      if (!accessKey || !secretKey) {
        console.error("Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY");
        res.status(500).end();
        return;
      }
      const token = await getToken({
        accessKey,
        secretKey,
      });
      res.setHeader(
        "Set-Cookie",
        serialize("edgestore", token, {
          path: "/",
          maxAge: 30 * 24 * 60 * 60, // 30 days
        })
      );
      res.json({
        token,
        baseUrl,
      });
    },
    requestUpload: async (req, res) => {
      const {
        path,
        name,
        extension,
        size,
        overwrite,
        public: isPublic,
      } = req.body;
      console.log("requestUpload", {
        path,
        name,
        extension,
        size,
        overwrite,
        isPublic,
      });
      const reqUploadResponse = await fetch(`${API_ENDPOINT}/request-upload`, {
        method: "POST",
        body: JSON.stringify({
          path,
          name,
          extension,
          size,
          overwrite,
          public: isPublic,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${accessKey}:${secretKey}`
          ).toString("base64")}`,
        },
      });
      const json = await reqUploadResponse.json();
      console.log("requestUpload", json);
      if (!json.signedUrl) {
        console.error(json);
        res.status(500).end();
      }
      res.status(200).json(json);
    },
    requestAccess: () => {
      // TODO: Implement
    },
  };
}

const getToken = async (params: { accessKey: string; secretKey: string }) => {
  const res = await fetch(`${API_ENDPOINT}/get-token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${params.accessKey}:${params.secretKey}`
      ).toString("base64")}`,
    },
  });
  const { token } = await res.json();
  return token;
};
