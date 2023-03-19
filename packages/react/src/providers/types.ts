import { NextApiRequest, NextApiResponse } from "next";

export type RequestUploadBody = {
  path?: string | undefined;
  name?: string | undefined;
  public?: boolean | undefined;
  overwrite?: boolean | undefined;
  extension: string;
  size: number;
};

export type Provider = {
  init: (req: NextApiRequest, res: NextApiResponse) => void | Promise<void>;
  requestUpload: (
    req: Omit<NextApiRequest, "body"> & { body: RequestUploadBody },
    res: NextApiResponse
  ) => void | Promise<void>;
  requestAccess: (
    req: NextApiRequest,
    res: NextApiResponse
  ) => void | Promise<void>;
};
