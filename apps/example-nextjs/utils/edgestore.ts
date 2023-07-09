import { EdgeStoreRouter } from "../pages/api/edgestore/[...edgestore]";
import { createEdgeStoreProvider } from "@edge-store/react";

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
