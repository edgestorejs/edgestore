import { createEdgeStoreProvider } from '@edgestore/react';
import { initEdgeStore } from '@edgestore/shared';
import { expectAssignable, expectNotAssignable, expectType } from 'tsd';
import { z } from 'zod';

const es = initEdgeStore.create();

const router = es.router({
  files: es.fileBucket(),
  images: es.imageBucket().path(() => [{ author: () => 'ctx.userId' }]),
  documents: es
    .fileBucket()
    .input(z.object({ category: z.enum(['invoice', 'contract']) })),
});

const { useEdgeStore } = createEdgeStoreProvider<typeof router>();

type Edgestore = ReturnType<typeof useEdgeStore>['edgestore'];
type FileUploadResponse = Awaited<ReturnType<Edgestore['files']['upload']>>;
type ImageUploadResponse = Awaited<ReturnType<Edgestore['images']['upload']>>;

expectType<[]>({} as FileUploadResponse['pathOrder']);
expectType<'author'[]>({} as ImageUploadResponse['pathOrder']);

type DocumentUploadParams = Parameters<Edgestore['documents']['upload']>[0];

expectAssignable<DocumentUploadParams>({
  file: {} as File,
  input: { category: 'invoice' },
});
expectNotAssignable<DocumentUploadParams>({ file: {} as File });
expectNotAssignable<DocumentUploadParams>({
  file: {} as File,
  input: { category: 'other' },
});
