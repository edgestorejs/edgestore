import { AnyEdgeStoreRouter } from "../core/internals/bucketBuilder";
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

export function EdgeStoreProvider(
  options?: EdgeStoreProviderOptions
): Provider {
  const {
    accessKey = process.env.EDGE_STORE_ACCESS_KEY!,
    secretKey = process.env.EDGE_STORE_SECRET_KEY!,
    baseUrl = process.env.EDGE_STORE_BASE_URL || DEFAULT_BASE_URL,
  } = options || {};
  return {
    init: async ({ ctx, router }) => {
      if (!accessKey || !secretKey) {
        throw new Error(
          "Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY"
        );
      }
      const token = await getToken({
        accessKey,
        secretKey,
        ctx,
        router,
      });
      return {
        token,
      };
    },
    getBaseUrl() {
      return baseUrl;
    },
    requestUpload: async ({ route, fileInfo }) => {
      console.log("requestUpload", fileInfo);
      const reqUploadResponse = await fetch(`${API_ENDPOINT}/request-upload`, {
        method: "POST",
        body: JSON.stringify({
          bucketName: fileInfo.routeName,
          bucketType: route._def.type,
          isPublic: fileInfo.isPublic,
          path: fileInfo.path,
          extension: fileInfo.extension,
          size: fileInfo.size,
          metadata: fileInfo.metadata,
        }),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${accessKey}:${secretKey}`
          ).toString("base64")}`,
        },
      });
      const json = await reqUploadResponse.json();
      console.log("requestUpload", JSON.stringify(json, null, 2));
      if (!json.signedUrl) {
        throw new Error(json);
      }
      return {
        uploadUrl: json.signedUrl,
        accessUrl: json.url,
      };
    },
  };
}

const getToken = async (params: {
  accessKey: string;
  secretKey: string;
  ctx: any;
  router: AnyEdgeStoreRouter<any>;
}) => {
  const reqRoutes = Object.entries(params.router.routes).reduce(
    (acc, [routeName, route]) => {
      acc[routeName] = {
        path: route._def.path.map((p: { [key: string]: () => string }) => {
          const [key, value] = Object.entries(p)[0];
          return {
            key,
            value: value(),
          };
        }),
        accessControl: route._def.accessControl,
      };
      return acc;
    },
    {} as any
  );
  console.log(
    JSON.stringify(
      {
        ctx: params.ctx,
        routes: reqRoutes,
      },
      null,
      2
    )
  );
  const res = await fetch(`${API_ENDPOINT}/get-token`, {
    method: "POST",
    body: JSON.stringify({
      ctx: params.ctx,
      routes: reqRoutes,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(
        `${params.accessKey}:${params.secretKey}`
      ).toString("base64")}`,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to get token");
  }
  const { token } = await res.json();
  return token;
};
