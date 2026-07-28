'use client';

import { createEdgeStoreProvider } from '@edgestore/react';
import { type InferClientResponse } from '@edgestore/server/core';
import { type EdgeStoreRouter } from '../app/api/edgestore/[...edgestore]/route';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };

/**
 * This helper type can be used to infer the response type of the backend client
 *
 * @example
 * ```ts
 * export const getServerSideProps: GetServerSideProps<{
 *   files: ClientResponse['images']['list']['items'];
 * }> = async () => {
 *   const res = await edgeStoreClient.images.list();
 *   return { props: { files: res.items } };
 * };
 * ```
 */
export type ClientResponse = InferClientResponse<EdgeStoreRouter>;
