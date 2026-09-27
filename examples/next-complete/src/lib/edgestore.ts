'use client';

import { createEdgeStoreProvider } from '@edgestore/react';
import type { EdgeStoreRouter } from './edgestore-server';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>({
    // Keep this low so queued uploads are easy to see.
    maxConcurrentUploads: 2,
  });

export { EdgeStoreProvider, useEdgeStore };
