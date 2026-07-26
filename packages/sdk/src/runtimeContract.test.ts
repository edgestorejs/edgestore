import { describe, expect, it, vi } from 'vitest';
import { createEdgeStoreSdk } from './sdk';

describe('runtime request mappings', () => {
  it('maps every runtime operation to its HTTP contract', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      requests.push(input instanceof Request ? input : new Request(input));
      return Response.json({ data: {} });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });
    const cases: {
      name: string;
      invoke: () => Promise<unknown>;
      method: string;
      path: string;
      body?: unknown;
    }[] = [
      {
        name: 'accessTokens.create',
        invoke: () =>
          sdk.runtime.accessTokens.create({ context: {}, buckets: {} }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/access-token',
        body: { context: {}, buckets: {} },
      },
      {
        name: 'projects.get',
        invoke: () => sdk.runtime.projects.get(),
        method: 'GET',
        path: '/v2/runtime/projects/_current',
      },
      {
        name: 'buckets.list',
        invoke: () => sdk.runtime.buckets.list(),
        method: 'GET',
        path: '/v2/runtime/projects/_current/buckets',
      },
      {
        name: 'buckets.get',
        invoke: () => sdk.runtime.buckets.get({ bucket: 'documents' }),
        method: 'GET',
        path: '/v2/runtime/projects/_current/buckets/documents',
      },
      {
        name: 'files.search',
        invoke: () =>
          sdk.runtime.files.search({
            bucket: 'documents',
            pagination: { cursor: 'next', limit: 10 },
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/buckets/documents/files/search',
        body: { pagination: { cursor: 'next', limit: 10 } },
      },
      {
        name: 'files.lookup',
        invoke: () =>
          sdk.runtime.files.lookup({
            file: { id: 'file-id' },
            bucketName: 'documents',
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/files/lookup',
        body: { file: { id: 'file-id' }, bucketName: 'documents' },
      },
      {
        name: 'files.createSignedUrls',
        invoke: () =>
          sdk.runtime.files.createSignedUrls({
            bucket: 'documents',
            urls: ['https://files.example/file'],
            expiresIn: 60,
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/buckets/documents/files/signed-urls',
        body: {
          urls: ['https://files.example/file'],
          expiresIn: 60,
        },
      },
      ...(
        [
          ['confirm', 'files/confirm'],
          ['delete', 'files/delete'],
          ['restore', 'files/restore'],
        ] as const
      ).map(([operation, path]) => ({
        name: `files.${operation}`,
        invoke: () =>
          sdk.runtime.files[operation]({
            files: [{ id: 'file-id' }],
            bucketName: 'documents',
          }),
        method: 'POST',
        path: `/v2/runtime/projects/_current/${path}`,
        body: {
          files: [{ id: 'file-id' }],
          bucketName: 'documents',
        },
      })),
      {
        name: 'uploads.request',
        invoke: () =>
          sdk.runtime.uploads.request({
            bucket: 'documents',
            bucketType: 'file',
            sizeBytes: 42,
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/buckets/documents/uploads',
        body: { bucketType: 'file', sizeBytes: 42 },
      },
      {
        name: 'uploads.get',
        invoke: () => sdk.runtime.uploads.get({ uploadId: 'upload-id' }),
        method: 'GET',
        path: '/v2/runtime/projects/_current/uploads/upload-id',
      },
      {
        name: 'uploads.cancel',
        invoke: () => sdk.runtime.uploads.cancel({ uploadId: 'upload-id' }),
        method: 'DELETE',
        path: '/v2/runtime/projects/_current/uploads/upload-id',
      },
      {
        name: 'uploads.createParts',
        invoke: () =>
          sdk.runtime.uploads.createParts({
            uploadId: 'upload-id',
            partNumbers: [1, 2],
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/uploads/upload-id/parts',
        body: { partNumbers: [1, 2] },
      },
      {
        name: 'uploads.completeMultipart',
        invoke: () =>
          sdk.runtime.uploads.completeMultipart({
            uploadId: 'upload-id',
            parts: [{ partNumber: 1, eTag: 'etag-1' }],
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/uploads/upload-id/complete',
        body: { parts: [{ partNumber: 1, eTag: 'etag-1' }] },
      },
    ];

    for (const testCase of cases) {
      requests.length = 0;
      await testCase.invoke();
      expect(requests, testCase.name).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, testCase.name).toBe(testCase.method);
      expect(new URL(request.url).pathname, testCase.name).toBe(testCase.path);
      if (testCase.body !== undefined) {
        await expect(request.json(), testCase.name).resolves.toEqual(
          testCase.body,
        );
      }
    }
  });
});
