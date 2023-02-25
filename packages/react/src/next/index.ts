import { NextApiRequest, NextApiResponse } from "next";
import EdgeStoreProvider from "../libs/providers/EdgeStoreProvider";
import { Provider } from "../libs/providers/types";

export type Config = {
  provider: Provider;
};

export default function EdgeStore(config?: Config) {
  const { provider = EdgeStoreProvider() } = config || {};
  return async (req: NextApiRequest, res: NextApiResponse) => {
    switch (req.url) {
      case "/api/edgestore/init":
        await provider.init(req, res);
        break;
      case "/api/edgestore/request-upload":
        await provider.requestUpload(req, res);
        break;
      case "/api/edgestore/request-access":
        await provider.requestAccess(req, res);
      default:
        res.status(404).end();
        break;
    }
  };
}
