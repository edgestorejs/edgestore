import { createEdgeStoreProvider } from '@edgestore/react';
import { defineProvider, initEdgeStore } from '@edgestore/server';
import { edgestore } from '@edgestore/server/providers/edgestore';
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
type FileMutationResponse = Awaited<
  ReturnType<Edgestore['files']['deleteMany']>
>;

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
expectType<string[]>({} as FileMutationResponse['succeeded']);
expectType<string>({} as FileMutationResponse['failed'][number]['url']);
expectType<string>(
  {} as FileMutationResponse['failed'][number]['error']['code'],
);

type FileUploadParams = Parameters<Edgestore['files']['upload']>[0];
expectAssignable<FileUploadParams>({
  file: {} as File,
  options: { temporary: true, replaceTargetUrl: 'https://files.example/a' },
});
expectType<string | undefined>({} as FileUploadResponse['key']);

const hosted = edgestore();
const keyOnlyRouter = router.provider(
  defineProvider({
    ...hosted,
    uploads: {
      ...hosted.uploads,
      supportedOptions: { temporary: false, replaceTargetUrl: false },
    },
  }),
);
const keyOnly = createEdgeStoreProvider<typeof keyOnlyRouter>();
type KeyOnlyUploadParams = Parameters<
  ReturnType<typeof keyOnly.useEdgeStore>['edgestore']['files']['upload']
>[0];
expectAssignable<KeyOnlyUploadParams>({
  file: {} as File,
  options: { manualFileName: 'a.txt' },
});
expectNotAssignable<KeyOnlyUploadParams>({
  file: {} as File,
  options: { temporary: true },
});
expectNotAssignable<KeyOnlyUploadParams>({
  file: {} as File,
  options: { replaceTargetUrl: 'https://files.example/a' },
});
