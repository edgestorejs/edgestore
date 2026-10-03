import { describe, expect, it, vi } from 'vitest';
import type { ManagementResourceOperationId } from './operationGroups.test.helper';
import { createEdgeStoreSdk } from './sdk';

type MappingCase = {
  invoke: () => Promise<unknown>;
  method: string;
  path: string;
  body?: unknown;
};

describe('management resource request mappings', () => {
  it('maps every supported resource method to its expected request', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      requests.push(input instanceof Request ? input : new Request(input));
      return Response.json({ data: {} });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { token: 'management-token' },
      apiUrl: 'https://example.com/v2',
      fetch,
    });
    const project = 'project-id';
    const bucket = 'documents';
    const uploadId = 'upload-id';
    const cases = {
      'v2.management.projects.list': {
        invoke: () => sdk.management.projects.list({ account: 'account-id' }),
        method: 'GET',
        path: '/v2/management/accounts/account-id/projects',
      },
      'v2.management.projects.create': {
        invoke: () =>
          sdk.management.projects.create({
            account: 'account-id',
            name: 'Website',
            createKey: true,
          }),
        method: 'POST',
        path: '/v2/management/accounts/account-id/projects',
        body: { name: 'Website', createKey: true },
      },
      'v2.management.projects.get': {
        invoke: () => sdk.management.projects.get({ project }),
        method: 'GET',
        path: `/v2/management/projects/${project}`,
      },
      'v2.management.projects.delete': {
        invoke: () => sdk.management.projects.delete({ project }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}`,
      },
      'v2.management.buckets.list': {
        invoke: () => sdk.management.buckets.list({ project }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets`,
      },
      'v2.management.buckets.create': {
        invoke: () =>
          sdk.management.buckets.create({
            project,
            name: bucket,
            type: 'file',
            visibility: 'protected',
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/buckets`,
        body: { name: bucket, type: 'file', visibility: 'protected' },
      },
      'v2.management.buckets.get': {
        invoke: () => sdk.management.buckets.get({ project, bucket }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}`,
      },
      'v2.management.buckets.update': {
        invoke: () =>
          sdk.management.buckets.update({
            project,
            bucket,
            metadata: { custom: ['category'] },
          }),
        method: 'PATCH',
        path: `/v2/management/projects/${project}/buckets/${bucket}`,
        body: { metadata: { custom: ['category'] } },
      },
      'v2.management.buckets.delete': {
        invoke: () => sdk.management.buckets.delete({ project, bucket }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}/buckets/${bucket}`,
      },
      'v2.management.buckets.empty': {
        invoke: () => sdk.management.buckets.empty({ project, bucket }),
        method: 'POST',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty`,
        body: {},
      },
      'v2.management.buckets.emptyJobs.latest': {
        invoke: () =>
          sdk.management.buckets.emptyJobs.latest({ project, bucket }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty-job`,
      },
      'v2.management.buckets.emptyJobs.get': {
        invoke: () =>
          sdk.management.buckets.emptyJobs.get({
            project,
            bucket,
            jobId: 'job-id',
          }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty-jobs/job-id`,
      },
      'v2.management.buckets.emptyJobs.retry': {
        invoke: () =>
          sdk.management.buckets.emptyJobs.retry({
            project,
            bucket,
            jobId: 'job-id',
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty-jobs/job-id/retry`,
        body: {},
      },
      'v2.management.files.list': {
        invoke: () =>
          sdk.management.files.list({
            project,
            bucket,
            cursor: 'next',
            limit: 10,
          }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}/files?cursor=next&limit=10`,
      },
      'v2.management.files.lookup': {
        invoke: () =>
          sdk.management.files.lookup({
            project,
            file: { id: 'file-id' },
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/files/lookup`,
        body: { file: { id: 'file-id' } },
      },
      'v2.management.files.generateAccessUrls': {
        invoke: () =>
          sdk.management.files.generateAccessUrls({
            project,
            files: [{ id: 'file-id' }],
            expiresIn: 60,
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/files/access-urls`,
        body: { files: [{ id: 'file-id' }], expiresIn: 60 },
      },
      'v2.management.files.delete': {
        invoke: () =>
          sdk.management.files.delete({
            project,
            files: [{ id: 'file-id' }],
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/files/delete`,
        body: { files: [{ id: 'file-id' }] },
      },
      'v2.management.uploads.request': {
        invoke: () =>
          sdk.management.uploads.request({
            project,
            bucket,
            sizeBytes: 42,
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/buckets/${bucket}/uploads`,
        body: { sizeBytes: 42 },
      },
      'v2.management.uploads.get': {
        invoke: () => sdk.management.uploads.get({ project, uploadId }),
        method: 'GET',
        path: `/v2/management/projects/${project}/uploads/${uploadId}`,
      },
      'v2.management.uploads.cancel': {
        invoke: () => sdk.management.uploads.cancel({ project, uploadId }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}/uploads/${uploadId}`,
      },
      'v2.management.uploads.parts.create': {
        invoke: () =>
          sdk.management.uploads.createParts({
            project,
            uploadId,
            partNumbers: [1],
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/uploads/${uploadId}/parts`,
        body: { partNumbers: [1] },
      },
      'v2.management.uploads.multipart.complete': {
        invoke: () =>
          sdk.management.uploads.completeMultipart({
            project,
            uploadId,
            parts: [{ partNumber: 1, eTag: 'etag-1' }],
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/uploads/${uploadId}/complete`,
        body: { parts: [{ partNumber: 1, eTag: 'etag-1' }] },
      },
    } satisfies Record<ManagementResourceOperationId, MappingCase>;

    for (const [operationId, testCase] of Object.entries(cases)) {
      requests.length = 0;
      await testCase.invoke();
      expect(requests, operationId).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, operationId).toBe(testCase.method);
      const url = new URL(request.url);
      expect(`${url.pathname}${url.search}`, operationId).toBe(testCase.path);
      if ('body' in testCase) {
        await expect(request.json(), operationId).resolves.toEqual(
          testCase.body,
        );
      }
    }
  });
});
