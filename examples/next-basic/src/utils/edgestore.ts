import { createEdgeStoreProvider } from '@edgestore/react';
import { EdgeStoreRouter } from '../pages/api/edgestore/[...edgestore]';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
