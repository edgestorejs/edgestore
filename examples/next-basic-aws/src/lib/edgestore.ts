import { createEdgeStoreProvider } from '@edgestore/react';
import { type EdgeStoreRouter } from '../pages/api/edgestore/[...edgestore]';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
