import { describe, expect, it, vi } from 'vitest';
import type { RuntimeOperationId } from './operationGroups.test.helper';
import { createEdgeStoreSdk } from './sdk';

type MappingCase = {
  invoke: () => Promise<unknown>;
  method: string;
  path: string;
  body?: unknown;
};

describe('runtime request mappings', () => {
  it('maps every runtime operation to its HTTP contract', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      requests.push(input instanceof Request ? input : new Request(input));
      return Response.json({ data: {} });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      apiUrl: 'https://example.com/v2',
      fetch,
    });
    const mutationBody = {
      files: [{ id: 'file-id' }],
      bucketName: 'documents',
    };
    const cases = {
      'v2.runtime.accessToken.create': {
        invoke: () =>
          sdk.runtime.accessTokens.create({ context: {}, buckets: {} }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/access-token',
        body: { context: {}, buckets: {} },
      },
      'v2.runtime.projects.get': {
        invoke: () => sdk.runtime.projects.get(),
        method: 'GET',
        path: '/v2/runtime/projects/_current',
      },
      'v2.runtime.buckets.list': {
        invoke: () => sdk.runtime.buckets.list(),
        method: 'GET',
        path: '/v2/runtime/projects/_current/buckets',
      },
      'v2.runtime.buckets.get': {
        invoke: () => sdk.runtime.buckets.get({ bucket: 'documents' }),
        method: 'GET',
        path: '/v2/runtime/projects/_current/buckets/documents',
      },
      'v2.runtime.files.search': {
        invoke: () =>
          sdk.runtime.files.search({
            bucket: 'documents',
            pagination: { cursor: 'next', limit: 10 },
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/buckets/documents/files/search',
        body: { pagination: { cursor: 'next', limit: 10 } },
      },
      'v2.runtime.files.lookup': {
        invoke: () =>
          sdk.runtime.files.lookup({
            file: { id: 'file-id' },
            bucketName: 'documents',
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/files/lookup',
        body: { file: { id: 'file-id' }, bucketName: 'documents' },
      },
      'v2.runtime.files.generateSignedReadUrls': {
        invoke: () =>
          sdk.runtime.files.generateSignedReadUrls({
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
      'v2.runtime.files.confirm': {
        invoke: () => sdk.runtime.files.confirmMany(mutationBody),
        method: 'POST',
        path: '/v2/runtime/projects/_current/files/confirm',
        body: mutationBody,
      },
      'v2.runtime.files.delete': {
        invoke: () => sdk.runtime.files.deleteMany(mutationBody),
        method: 'POST',
        path: '/v2/runtime/projects/_current/files/delete',
        body: mutationBody,
      },
      'v2.runtime.files.restore': {
        invoke: () => sdk.runtime.files.restoreMany(mutationBody),
        method: 'POST',
        path: '/v2/runtime/projects/_current/files/restore',
        body: mutationBody,
      },
      'v2.runtime.uploads.request': {
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
      'v2.runtime.uploads.get': {
        invoke: () => sdk.runtime.uploads.get({ uploadId: 'upload-id' }),
        method: 'GET',
        path: '/v2/runtime/projects/_current/uploads/upload-id',
      },
      'v2.runtime.uploads.cancel': {
        invoke: () => sdk.runtime.uploads.cancel({ uploadId: 'upload-id' }),
        method: 'DELETE',
        path: '/v2/runtime/projects/_current/uploads/upload-id',
      },
      'v2.runtime.uploads.parts.create': {
        invoke: () =>
          sdk.runtime.uploads.createParts({
            uploadId: 'upload-id',
            partNumbers: [1, 2],
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/uploads/upload-id/parts',
        body: { partNumbers: [1, 2] },
      },
      'v2.runtime.uploads.multipart.complete': {
        invoke: () =>
          sdk.runtime.uploads.completeMultipart({
            uploadId: 'upload-id',
            parts: [{ partNumber: 1, eTag: 'etag-1' }],
          }),
        method: 'POST',
        path: '/v2/runtime/projects/_current/uploads/upload-id/complete',
        body: { parts: [{ partNumber: 1, eTag: 'etag-1' }] },
      },
    } satisfies Record<RuntimeOperationId, MappingCase>;

    for (const [operationId, testCase] of Object.entries(cases)) {
      requests.length = 0;
      await testCase.invoke();
      expect(requests, operationId).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, operationId).toBe(testCase.method);
      expect(new URL(request.url).pathname, operationId).toBe(testCase.path);
      if ('body' in testCase) {
        await expect(request.json(), operationId).resolves.toEqual(
          testCase.body,
        );
      }
    }
  });
});
