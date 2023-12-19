import { createEdgeStoreProvider } from '@edgestore/react';
import { type EdgeStoreRouter } from '../../../express-basic/src';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
