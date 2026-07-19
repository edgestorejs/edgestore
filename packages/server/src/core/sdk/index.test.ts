import { initEdgeStore } from '@edgestore/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EDGE_STORE_PACKAGE_NAME,
  EDGE_STORE_PACKAGE_VERSION,
} from '../../version';

const DEFAULT_API_ENDPOINT = 'https://api.edgestore.dev';

async function importSdk(params?: { apiEndpoint?: string }) {
  vi.resetModules();
  vi.stubEnv('EDGE_STORE_API_ENDPOINT', params?.apiEndpoint);
  return await import('.');
}

function mockFetchJson(body: unknown, init?: Partial<Response>) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => body,
    text: async () => JSON.stringify(body),
    ...init,
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function getFetchBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(init?.body as string);
}

const fileInfo = {
  size: 123,
  extension: 'txt',
  type: 'text/plain',
  isPublic: true,
  path: [{ key: 'org', value: 'acme' }],
  metadata: { owner: 'user-1' },
  fileName: 'readme.txt',
  replaceTargetUrl: 'https://files.example.com/old.txt',
  temporary: false,
};

describe('initEdgeStoreSdk', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends basic auth, package headers, and a JSON body through public SDK APIs', async () => {
    const { initEdgeStoreSdk } = await importSdk();
    const fetchMock = mockFetchJson({
      signedUrl: 'https://upload.example.com/file.txt',
      url: 'https://files.example.com/file.txt',
      path: 'bucket/file.txt',
      thumbnailUrl: null,
    });
    const sdk = initEdgeStoreSdk({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await sdk.requestUpload({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_API_ENDPOINT}/request-upload`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from('access-key:secret-key').toString(
            'base64',
          )}`,
          'x-edgestore-package-name': EDGE_STORE_PACKAGE_NAME,
          'x-edgestore-package-version': EDGE_STORE_PACKAGE_VERSION,
        },
      }),
    );
    expect(getFetchBody(fetchMock)).toEqual({
      bucketName: 'documents',
      bucketType: 'FILE',
      isPublic: true,
      path: [{ key: 'org', value: 'acme' }],
      extension: 'txt',
      size: 123,
      mimeType: 'text/plain',
      metadata: { owner: 'user-1' },
      fileName: 'readme.txt',
      replaceTargetUrl: 'https://files.example.com/old.txt',
      isTemporary: false,
    });
  });

  it('includes response text when a request fails', async () => {
    const { initEdgeStoreSdk } = await importSdk();
    const fetchMock = mockFetchJson(undefined, {
      ok: false,
      text: async () => 'invalid project credentials',
    });
    const sdk = initEdgeStoreSdk({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await expect(
      sdk.confirmUpload({
        url: 'https://files.example.com/file.txt',
      }),
    ).rejects.toThrow(
      'Failed to make request to /confirm-upload: invalid project credentials',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws EdgeStoreCredentialsError when credentials are missing', async () => {
    const { initEdgeStoreSdk } = await importSdk();
    const { default: EdgeStoreCredentialsError } = await import(
      '../../libs/errors/EdgeStoreCredentialsError'
    );

    expect(() =>
      initEdgeStoreSdk({
        accessKey: '',
        secretKey: 'secret-key',
      }),
    ).toThrow(EdgeStoreCredentialsError);
  });

  it('uses EDGE_STORE_API_ENDPOINT when provided', async () => {
    const { initEdgeStoreSdk } = await importSdk({
      apiEndpoint: 'https://api.test.invalid',
    });
    const fetchMock = mockFetchJson({
      signedUrl: 'https://upload.example.com/file.txt',
      url: 'https://files.example.com/file.txt',
      path: 'bucket/file.txt',
      thumbnailUrl: null,
    });
    const sdk = initEdgeStoreSdk({
      accessKey: 'access-key',
      secretKey: 'secret-key',
    });

    await sdk.requestUpload({
      bucketName: 'documents',
      bucketType: 'FILE',
      fileInfo,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test.invalid/request-upload',
      expect.any(Object),
    );
  });
});

describe('edgeStoreRawSdk.getToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('serializes router bucket path and accessControl in the request body', async () => {
    const { edgeStoreRawSdk } = await importSdk();
    const fetchMock = mockFetchJson({ token: 'edge-token' });
    const es = initEdgeStore
      .context<{ userId: string; orgId: string }>()
      .create();
    const router = es.router({
      documents: es
        .fileBucket()
        .path(({ ctx }) => [{ owner: ctx.userId }, { org: ctx.orgId }])
        .accessControl({
          userId: { eq: { path: 'owner' } },
          orgId: { eq: { path: 'org' } },
        }),
    });

    await expect(
      edgeStoreRawSdk.getToken({
        accessKey: 'access-key',
        secretKey: 'secret-key',
        ctx: { userId: 'user-1', orgId: 'org-1' },
        router,
      }),
    ).resolves.toBe('edge-token');

    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_API_ENDPOINT}/get-token`,
      expect.any(Object),
    );
    expect(getFetchBody(fetchMock)).toEqual({
      ctx: { userId: 'user-1', orgId: 'org-1' },
      buckets: {
        documents: {
          path: [
            { key: 'owner', value: 'ctx.userId' },
            { key: 'org', value: 'ctx.orgId' },
          ],
          accessControl: {
            userId: { eq: { path: 'owner' } },
            orgId: { eq: { path: 'org' } },
          },
        },
      },
    });
  });
});
