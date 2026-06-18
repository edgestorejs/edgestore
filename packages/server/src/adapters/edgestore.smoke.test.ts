import { describe, expect, it } from 'vitest';

const smokeBaseUrl = process.env.EDGESTORE_SMOKE_BASE_URL;
const smokeBucketName =
  process.env.EDGESTORE_SMOKE_BUCKET_NAME ?? 'publicFiles';

type HeadersWithSetCookie = Headers & {
  getSetCookie?: () => string[];
};

function getCookieHeader(res: Response) {
  const setCookies =
    (res.headers as HeadersWithSetCookie).getSetCookie?.() ??
    [res.headers.get('set-cookie')].filter((cookie): cookie is string =>
      Boolean(cookie),
    );

  return setCookies.map((cookie) => cookie.split(';')[0]).join('; ');
}

async function expectOk(res: Response) {
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
}

function getSmokeBaseUrl() {
  if (!smokeBaseUrl) {
    throw new Error('EDGESTORE_SMOKE_BASE_URL is required');
  }

  return smokeBaseUrl.replace(/\/$/, '');
}

async function deleteUploadedFile(params: {
  baseUrl: string;
  cookie: string;
  url: string;
}) {
  const deleteRes = await fetch(`${params.baseUrl}/delete-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: params.cookie,
    },
    body: JSON.stringify({
      bucketName: smokeBucketName,
      url: params.url,
    }),
  });
  await expectOk(deleteRes);

  expect(await deleteRes.json()).toMatchObject({
    success: true,
  });
}

describe('EdgeStore live smoke test', () => {
  it('initializes, requests an upload URL, uploads, confirms, and deletes the file', async () => {
    const baseUrl = getSmokeBaseUrl();
    let cookie: string | undefined;
    let accessUrl: string | undefined;

    try {
      const healthRes = await fetch(`${baseUrl}/health`);
      await expectOk(healthRes);
      expect(await healthRes.text()).toBe('OK');

      const initRes = await fetch(`${baseUrl}/init`);
      await expectOk(initRes);

      cookie = getCookieHeader(initRes);
      const initJson = (await initRes.json()) as {
        baseUrl?: string;
        providerName?: string;
      };

      expect(initJson).toMatchObject({
        baseUrl: expect.any(String),
        providerName: expect.any(String),
      });
      expect(cookie).toContain('edgestore-ctx=');

      const fileBody = new Blob(['edgestore smoke test'], {
        type: 'text/plain',
      });

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
            fileName: `smoke-${Date.now()}.txt`,
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

      expect(uploadInfo).toMatchObject({
        accessUrl: expect.any(String),
        size: fileBody.size,
        uploadUrl: expect.any(String),
      });

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
      accessUrl = uploadInfo.accessUrl;

      const confirmRes = await fetch(`${baseUrl}/confirm-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          bucketName: smokeBucketName,
          url: uploadInfo.accessUrl,
        }),
      });
      await expectOk(confirmRes);

      expect(await confirmRes.json()).toMatchObject({
        success: true,
      });
    } finally {
      if (cookie && accessUrl) {
        await deleteUploadedFile({
          baseUrl,
          cookie,
          url: accessUrl,
        });
      }
    }
  });
});
