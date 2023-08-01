'use client';

import { EdgeStoreRouter } from '@/app/api/edgestore/[...edgestore]/route';
import { createEdgeStoreProvider } from '@edge-store/react';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
