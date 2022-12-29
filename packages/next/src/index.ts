import { NextApiRequest, NextApiResponse } from "next";
import { serialize } from "cookie";

export default function EdgeStore() {
  return (req: NextApiRequest, res: NextApiResponse) => {
    res.setHeader(
      "Set-Cookie",
      serialize("edgestore", "test", {
        path: "/",
        maxAge: 60 * 60 * 8, // 8 hours
      })
    );
    res.status(200).send();
  };
}
