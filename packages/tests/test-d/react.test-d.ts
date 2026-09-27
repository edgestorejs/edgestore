import { createEdgeStoreProvider } from '@edgestore/react';
import { initEdgeStore } from '@edgestore/server';
import { edgestore } from '@edgestore/server/providers/edgestore';
import { s3 } from '@edgestore/server/providers/s3';
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

// The provider flows through the router without an extra React generic.
const s3Router = router.provider(s3());
const s3Hooks = createEdgeStoreProvider<typeof s3Router>();
type S3Client = ReturnType<typeof s3Hooks.useEdgeStore>['edgestore'];
type S3Upload = Parameters<S3Client['files']['upload']>[0];
type S3DocumentUpload = Parameters<S3Client['documents']['upload']>[0];
expectAssignable<S3Upload>({
  file: {} as File,
  options: { manualFileName: 'report.txt', transform: ({ file }) => file },
});
expectNotAssignable<S3Upload>({
  file: {} as File,
  options: { temporary: true },
});
expectNotAssignable<S3Upload>({
  file: {} as File,
  options: { replaceTargetUrl: 'https://files.example/old' },
});
const lifecycleOptions = { manualFileName: 'report.txt', temporary: true };
expectNotAssignable<S3Upload>({ file: {} as File, options: lifecycleOptions });
expectNotAssignable<S3DocumentUpload>({
  file: {} as File,
  input: { category: 'invoice' },
  options: lifecycleOptions,
});
expectAssignable<S3DocumentUpload>({
  file: {} as File,
  input: { category: 'invoice' },
});
expectNotAssignable<S3DocumentUpload>({ file: {} as File });
expectAssignable<Parameters<Edgestore['files']['upload']>[0]>({
  file: {} as File,
  options: lifecycleOptions,
});

const restoredRouter = s3Router.provider(edgestore());
const restoredHooks = createEdgeStoreProvider<typeof restoredRouter>();
type RestoredClient = ReturnType<
  typeof restoredHooks.useEdgeStore
>['edgestore'];
expectAssignable<Parameters<RestoredClient['files']['upload']>[0]>({
  file: {} as File,
  options: { temporary: true, replaceTargetUrl: 'https://files.example/old' },
});
