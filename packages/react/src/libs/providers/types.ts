import { NextApiRequest, NextApiResponse } from "next";

export type Provider = {
  init: (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>;
  requestUpload: (
    req: NextApiRequest,
    res: NextApiResponse
  ) => void | Promise<void>;
  requestAccess: (
    req: NextApiRequest,
    res: NextApiResponse
  ) => void | Promise<void>;
};
