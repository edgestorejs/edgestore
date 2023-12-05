'use client';

import { createEdgeStoreProvider } from '@edgestore/react';
import { type InferClientResponse } from '@edgestore/server/core';
import { type EdgeStoreRouter } from '../app/api/edgestore/[...edgestore]/route';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };

/**
 * This helper type can be used to infer the response type of the vanilla client (used in your backend)
 *
 * @example
 * ```ts
 * export const getServerSideProps: GetServerSideProps<{
 *   files: ClientResponse['images']['listFiles']['data'];
 * }> = async () => {
 *   const res = await edgeStoreClient.images.listFiles();
 *   return { props: { files: res.data } };
 * };
 * ```
 */
export type ClientResponse = InferClientResponse<EdgeStoreRouter>;
