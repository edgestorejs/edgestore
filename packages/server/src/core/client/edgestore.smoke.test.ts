import { initEdgeStore } from '@edgestore/shared';
import { describe, expect, it } from 'vitest';
import { createEdgeStoreClient } from '.';
import {
  createSmokeFileName,
  getSmokeBucketName,
  requireSmokeCredentials,
  runSmokeUploadLifecycle,
  SMOKE_CONTENT,
} from '../../test-utils/edgestoreSmoke';

const smokeBucketName = getSmokeBucketName();

function createSmokeBucketClient() {
  const es = initEdgeStore.create();
  const router = es.router({
    [smokeBucketName]: es.fileBucket(),
  });
  const client = createEdgeStoreClient({
    router,
  });
  const bucketClient = client[smokeBucketName];
  if (!bucketClient) {
    throw new Error(`Smoke bucket ${smokeBucketName} was not initialized`);
  }

  return bucketClient;
}

describe('EdgeStore backend client live smoke test', () => {
  it('uploads, confirms, reads, and deletes a file', async () => {
    requireSmokeCredentials();

    const bucketClient = createSmokeBucketClient();
    const uploadRes = await runSmokeUploadLifecycle({
      expectedSize: SMOKE_CONTENT.length,
      deleteDescription: 'deleteFile',
      upload: async () => {
        const file = await bucketClient.upload({
          content: SMOKE_CONTENT,
          options: {
            manualFileName: createSmokeFileName('client'),
            temporary: true,
          },
        });
        return { url: file.url, size: file.sizeBytes };
      },
      confirmUpload: async (url) => {
        await bucketClient.confirmUpload({ url });
        return { success: true };
      },
      getFile: async (url) => {
        const file = await bucketClient.getFile({ url });
        return { url: file.url, size: file.sizeBytes };
      },
      deleteFile: async (url) => {
        await bucketClient.deleteFile({ url });
        return { success: true };
      },
    });

    expect(uploadRes).toMatchObject({
      size: SMOKE_CONTENT.length,
      url: expect.any(String),
    });
  });
});
