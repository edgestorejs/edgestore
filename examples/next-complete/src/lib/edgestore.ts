import { createEdgeStoreProvider } from '@edgestore/react';
import { type InferClientOutputs } from '@edgestore/server';
import { type EdgeStoreRouter } from '../pages/api/edgestore/[...edgestore]';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };

/**
 * This helper type can be used to infer the output types of the backend client
 *
 * @example
 * ```ts
 * export const getServerSideProps: GetServerSideProps<{
 *   files: ClientOutputs['images']['listFiles']['items'];
 * }> = async () => {
 *   const res = await edgestoreClient.images.listFiles();
 *   return { props: { files: res.items } };
 * };
 * ```
 */
export type ClientOutputs = InferClientOutputs<EdgeStoreRouter>;
