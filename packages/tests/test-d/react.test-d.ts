import { createEdgeStoreProvider } from '@edgestore/react';
import { initEdgeStore } from '@edgestore/shared';
import { expectType } from 'tsd';

const es = initEdgeStore.create();

const router = es.router({
  files: es.fileBucket(),
  images: es.imageBucket().path(() => [{ author: () => 'ctx.userId' }]),
});

const { useEdgeStore } = createEdgeStoreProvider<typeof router>();

type Edgestore = ReturnType<typeof useEdgeStore>['edgestore'];
type FileUploadResponse = Awaited<ReturnType<Edgestore['files']['upload']>>;
type ImageUploadResponse = Awaited<ReturnType<Edgestore['images']['upload']>>;

expectType<[]>({} as FileUploadResponse['pathOrder']);
expectType<'author'[]>({} as ImageUploadResponse['pathOrder']);
