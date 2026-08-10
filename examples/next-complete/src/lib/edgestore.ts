'use client';

import { createEdgeStoreProvider } from '@edgestore/react';
import type { EdgeStoreRouter } from './edgestore-server';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>({
    maxConcurrentUploads: 2,
  });

export { EdgeStoreProvider, useEdgeStore };
