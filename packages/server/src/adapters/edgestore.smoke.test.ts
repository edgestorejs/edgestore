import { initEdgeStore } from '@edgestore/shared';
import { parse } from 'cookie';
import express from 'express';
import { describe, expect, it } from 'vitest';
import {
  createSmokeFileName,
  getSmokeBucketName,
  requireSmokeCredentials,
  runSmokeUploadLifecycle,
  SMOKE_CONTENT,
} from '../test-utils/edgestoreSmoke';
import { createEdgeStoreExpressHandler } from './express';

const smokeBucketName = getSmokeBucketName();

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

function getCookieHeader(res: Response) {
  const setCookies =
    (res.headers as HeadersWithSetCookie).getSetCookie?.() ??
    [res.headers.get('set-cookie')].filter((cookie): cookie is string =>
      Boolean(cookie),
    );

  return setCookies
    .map((cookie) => {
      const [name, value] = Object.entries(parse(cookie))[0] ?? [];
      if (!name || !value) {
        throw new Error(`Could not parse Set-Cookie header: ${cookie}`);
      }

      return `${name}=${value}`;
    })
    .join('; ');
}

async function expectOk(res: Response) {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
}

async function createSmokeServer() {
  const es = initEdgeStore.create();
  const router = es.router({
    [smokeBucketName]: es.fileBucket().beforeDelete(() => true),
  });
  const handler = createEdgeStoreExpressHandler({
    router,
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.cookies = parse(req.headers.cookie ?? '');
    next();
  });
  app.get('/edgestore/*', handler);
  app.post('/edgestore/*', handler);

  const server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve) => {
    server.once('listening', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not determine smoke server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/edgestore`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
}

describe('EdgeStore adapter live smoke test', () => {
  it('initializes, requests an upload URL, uploads, confirms, and deletes the file', async () => {
    requireSmokeCredentials();

    const smokeServer = await createSmokeServer();
    const baseUrl = smokeServer.baseUrl;

    try {
      const healthRes = await fetch(`${baseUrl}/health`);
      await expectOk(healthRes);
      expect(await healthRes.text()).toBe('OK');

      const initRes = await fetch(`${baseUrl}/init`);
      await expectOk(initRes);

      const cookie = getCookieHeader(initRes);
      const initJson = (await initRes.json()) as {
        baseUrl?: string;
        providerName?: string;
      };

      expect(initJson).toMatchObject({
        baseUrl: expect.any(String),
        providerName: expect.any(String),
      });
      expect(cookie).toContain('edgestore-ctx=');

      const fileBody = new Blob([SMOKE_CONTENT], {
        type: 'text/plain',
      });

      const uploadRes = await runSmokeUploadLifecycle({
        expectedSize: fileBody.size,
        deleteDescription: 'delete-file',
        upload: async () => {
          const requestUploadRes = await fetch(`${baseUrl}/request-upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookie,
            },
            body: JSON.stringify({
              bucketName: smokeBucketName,
              input: {},
              fileInfo: {
                extension: 'txt',
                fileName: createSmokeFileName('adapter'),
                size: fileBody.size,
                temporary: true,
                type: fileBody.type,
              },
            }),
          });
          await expectOk(requestUploadRes);

          const uploadInfo = (await requestUploadRes.json()) as {
            accessUrl?: string;
            size?: number;
            uploadUrl?: string;
          };

          if (!uploadInfo.uploadUrl || !uploadInfo.accessUrl) {
            throw new Error(
              'Upload URL or access URL missing from upload response',
            );
          }

          const uploadRes = await fetch(uploadInfo.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': fileBody.type,
            },
            body: fileBody,
          });
          await expectOk(uploadRes);

          return {
            size: uploadInfo.size ?? 0,
            url: uploadInfo.accessUrl,
          };
        },
        confirmUpload: async (url) => {
          const confirmRes = await fetch(`${baseUrl}/confirm-upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookie,
            },
            body: JSON.stringify({
              bucketName: smokeBucketName,
              url,
            }),
          });
          await expectOk(confirmRes);

          return (await confirmRes.json()) as { success: boolean };
        },
        deleteFile: async (url) => {
          const deleteRes = await fetch(`${baseUrl}/delete-file`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: cookie,
            },
            body: JSON.stringify({
              bucketName: smokeBucketName,
              url,
            }),
          });
          await expectOk(deleteRes);

          return (await deleteRes.json()) as { success: boolean };
        },
      });

      expect(uploadRes).toMatchObject({
        size: fileBody.size,
        url: expect.any(String),
      });
    } finally {
      await smokeServer.close();
    }
  });
});
