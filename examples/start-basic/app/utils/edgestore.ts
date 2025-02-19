import { createEdgeStoreProvider } from '@edgestore/react';
import { type EdgeStoreRouter } from '../routes/api/edgestore.$';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
