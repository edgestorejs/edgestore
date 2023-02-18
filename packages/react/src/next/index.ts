import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";
import config from "../libs/config";

export default function EdgeStore() {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    switch (req.url) {
      case "/api/edgestore/init":
        await init(req, res);
        break;
      case "/api/edgestore/request-upload":
        await requestUpload(req, res);
        break;
      default:
        res.status(404).end();
        break;
    }
  };
}

const init = async (req: NextApiRequest, res: NextApiResponse) => {
  const accessKey = process.env.EDGE_STORE_ACCESS_KEY;
  const secretKey = process.env.EDGE_STORE_SECRET_KEY;
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
    baseUrl: process.env.EDGE_STORE_BASE_URL || config.edgeStoreBaseUrl,
  });
};

const requestUpload = async (req: NextApiRequest, res: NextApiResponse) => {
  const { path, name, extension, size, overwrite, public: isPublic } = req.body;
  const accessKey = process.env.EDGE_STORE_ACCESS_KEY;
  const secretKey = process.env.EDGE_STORE_SECRET_KEY;
  console.log("requestUpload", {
    path,
    name,
    extension,
    size,
    overwrite,
    isPublic,
  });
  const reqUploadResponse = await fetch(
    `${config.edgeStoreApiEndpoint}/request-upload`,
    {
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
    }
  );
  const json = await reqUploadResponse.json();
  console.log("requestUpload", json);
  if (!json.signedUrl) {
    console.error(json);
    res.status(500).end();
  }
  res.status(200).json(json);
};

const getToken = async (params: { accessKey: string; secretKey: string }) => {
  const res = await fetch(`${config.edgeStoreApiEndpoint}/get-token`, {
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
