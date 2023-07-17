import { createEdgeStoreProvider } from '@edge-store/react';
import { InferClientResponse } from '@edge-store/server/core';
import { EdgeStoreRouter } from '../pages/api/edgestore/[...edgestore]';

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
