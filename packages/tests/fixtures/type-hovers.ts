import { createEdgeStoreProvider } from '@edgestore/react';
import { createEdgeStore } from '@edgestore/server';
import { createEdgeStoreFastifyHandler } from '@edgestore/server/adapters/fastify';
import { createEdgeStoreHonoHandler } from '@edgestore/server/adapters/hono';
import { edgestore as createHostedProvider } from '@edgestore/server/providers/edgestore';
import { initEdgeStore } from '@edgestore/shared';
import { z } from 'zod';

type Context = {
  userId: string;
  role: 'admin' | 'visitor';
};

const es = initEdgeStore.context<Context>().create();

const privateFiles = es
  .fileBucket()
  .input(
    z.object({
      category: z.enum(['invoice', 'contract']),
    }),
  )
  .path((pathArgs) => [
    { owner: pathArgs.ctx.userId },
    { category: pathArgs.input.category },
  ])
  .metadata((metadataArgs) => ({
    role: metadataArgs.ctx.role,
    category: metadataArgs.input.category,
  }))
  .beforeUpload((beforeUploadArgs) => {
    return beforeUploadArgs.fileInfo.size > 0;
  })
  .beforeDelete((beforeDeleteArgs) => {
    return beforeDeleteArgs.fileInfo.metadata.role === 'admin';
  })
  .accessControl('private')
  .autoSignedUrls();

const router = es.router({
  publicFiles: es.fileBucket(),
  privateFiles,
  privateImages: es
    .imageBucket()
    .accessControl('private')
    .autoSignedUrls({ includeThumbnails: true }),
});

const edgeStore = createEdgeStore({
  router,
  provider: createHostedProvider(),
});
const backendClient = edgeStore.client;
const { useEdgeStore } = createEdgeStoreProvider<typeof router>();
const { edgestore, state: providerState } = useEdgeStore();
const backendSignedUploadMethod = backendClient.privateFiles.upload;
const reactSignedUploadMethod = edgestore.privateFiles.upload;

const honoHandler = createEdgeStoreHonoHandler({
  edgeStore,
  createContext: () => ({ userId: 'user-1', role: 'admin' }),
});

const fastifyHandler = createEdgeStoreFastifyHandler({
  edgeStore,
  createContext: () => ({ userId: 'user-1', role: 'admin' }),
});

async function inspectOperationResults() {
  const backendUnsignedUpload = await backendClient.publicFiles.upload({
    content: 'hello',
    ctx: { userId: 'user-1', role: 'admin' },
  });
  const backendSignedFileUpload = await backendClient.privateFiles.upload({
    content: 'hello',
    ctx: { userId: 'user-1', role: 'admin' },
    input: { category: 'invoice' },
  });
  const backendGetFile = await backendClient.privateFiles.get({
    url: 'https://example.com/file',
  });
  const backendListFiles = await backendClient.privateFiles.list();
  const backendGetSignedUrl = await backendClient.privateFiles.createSignedUrl({
    url: 'https://example.com/file',
  });
  const backendGetSignedUrls =
    await backendClient.privateImages.createSignedUrls({
      urls: ['https://example.com/image'],
    });

  const reactUnsignedUpload = await edgestore.publicFiles.upload({
    file: null! as File,
  });
  const reactSignedFileUpload = await edgestore.privateFiles.upload({
    file: null! as File,
    input: { category: 'invoice' },
  });
  const reactSignedImageUpload = await edgestore.privateImages.upload({
    file: null! as File,
  });

  return {
    backendUnsignedUpload,
    backendSignedFileUpload,
    backendGetFile,
    backendListFiles,
    backendGetSignedUrl,
    backendGetSignedUrls,
    reactUnsignedUpload,
    reactSignedFileUpload,
    reactSignedImageUpload,
  };
}

void inspectOperationResults;
