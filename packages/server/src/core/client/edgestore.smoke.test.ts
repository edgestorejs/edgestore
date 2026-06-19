import { initEdgeStore } from '@edgestore/shared';
import { describe, expect, it } from 'vitest';
import { initEdgeStoreClient } from '.';
import {
  createSmokeFileName,
  getSmokeBucketName,
  requireSmokeCredentials,
  retryUntilSuccess,
  SMOKE_CONTENT,
} from '../../test-utils/edgestoreSmoke';

const smokeBucketName = getSmokeBucketName();

function createSmokeBucketClient() {
  const es = initEdgeStore.create();
  const router = es.router({
    [smokeBucketName]: es.fileBucket(),
  });
  const client = initEdgeStoreClient({
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
    let accessUrl: string | undefined;

    try {
      const uploadRes = await bucketClient.upload({
        content: SMOKE_CONTENT,
        options: {
          manualFileName: createSmokeFileName('client'),
          temporary: true,
        },
      });
      accessUrl = uploadRes.url;

      expect(uploadRes).toMatchObject({
        size: SMOKE_CONTENT.length,
        url: expect.any(String),
      });

      await expect(
        bucketClient.confirmUpload({
          url: accessUrl,
        }),
      ).resolves.toMatchObject({
        success: true,
      });

      await expect(
        bucketClient.getFile({
          url: accessUrl,
        }),
      ).resolves.toMatchObject({
        size: SMOKE_CONTENT.length,
        url: expect.any(String),
      });
    } finally {
      if (accessUrl) {
        const url = accessUrl;
        await retryUntilSuccess({
          description: 'deleteFile',
          action: () =>
            bucketClient.deleteFile({
              url,
            }),
        });
      }
    }
  });
});
