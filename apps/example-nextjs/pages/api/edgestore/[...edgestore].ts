import { initEdgeStore } from "@edge-store/react/server";
import {
  CreateNextContextOptions,
  createEdgeStoreNextHandler,
} from "@edge-store/react/server/adapters";
import { AnyEdgeStoreRouter } from "@edge-store/react/server/core/internals/bucketBuilder";
import { z } from "zod";

type Context = {
  userId: string;
  userRole: "admin" | "visitor";
};

function createContext(_opts: CreateNextContextOptions): Context {
  return {
    userId: "123",
    userRole: "admin",
  };
}

const es = initEdgeStore.context<Context>().create();

const imagesBucket = es.imageBucket
  .input(
    z.object({
      type: z.enum(["profile", "post"]),
      extension: z.string().optional(),
    })
  )
  .path(({ ctx, input }) => [{ author: ctx.userId }, { type: input.type }])
  .metadata(({ ctx, input }) => ({
    extension: input.extension,
    role: ctx.userRole,
  }))
  .beforeUpload(({ ctx, input }) => {
    console.log(ctx, input);
    return true;
  });

const filesBucket = es.fileBucket
  .path(({ ctx }) => [{ author: ctx.userId }])
  .metadata(({ ctx }) => ({
    role: ctx.userRole,
  }))
  .accessControl({
    OR: [
      {
        userId: { path: "author" }, // this will check if the userId is the same as the author in the path parameter
      },
      {
        userRole: "admin", // this is the same as { userRole: { eq: "admin" } }
      },
    ],
  });

const edgeStoreRouter = es.router({
  images: imagesBucket,
  files: filesBucket,
});

edgeStoreRouter satisfies AnyEdgeStoreRouter<Context>;

export type EdgeStoreRouter = typeof edgeStoreRouter;

export default createEdgeStoreNextHandler<Context>({
  router: edgeStoreRouter,
  createContext,
});
