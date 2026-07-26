import { describe, expect, it, vi } from 'vitest';
import { createEdgeStoreSdk } from './sdk';

describe('management resource request mappings', () => {
  it('maps every resource operation to its HTTP contract', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      requests.push(input instanceof Request ? input : new Request(input));
      return Response.json({ data: {} });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { token: 'management-token' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });
    const project = 'project-id';
    const bucket = 'documents';
    const uploadId = 'upload-id';
    const cases: {
      name: string;
      invoke: () => Promise<unknown>;
      method: string;
      path: string;
      body?: unknown;
    }[] = [
      {
        name: 'projects.list',
        invoke: () => sdk.management.projects.list({ account: 'account-id' }),
        method: 'GET',
        path: '/v2/management/accounts/account-id/projects',
      },
      {
        name: 'projects.create',
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
      {
        name: 'projects.get',
        invoke: () => sdk.management.projects.get({ project }),
        method: 'GET',
        path: `/v2/management/projects/${project}`,
      },
      {
        name: 'projects.delete',
        invoke: () => sdk.management.projects.delete({ project }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}`,
      },
      {
        name: 'buckets.list',
        invoke: () => sdk.management.buckets.list({ project }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets`,
      },
      {
        name: 'buckets.create',
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
      {
        name: 'buckets.get',
        invoke: () => sdk.management.buckets.get({ project, bucket }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}`,
      },
      {
        name: 'buckets.update',
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
      {
        name: 'buckets.delete',
        invoke: () => sdk.management.buckets.delete({ project, bucket }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}/buckets/${bucket}`,
      },
      {
        name: 'buckets.empty',
        invoke: () => sdk.management.buckets.empty({ project, bucket }),
        method: 'POST',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty`,
        body: {},
      },
      {
        name: 'buckets.emptyJobs.latest',
        invoke: () =>
          sdk.management.buckets.emptyJobs.latest({ project, bucket }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty-job`,
      },
      {
        name: 'buckets.emptyJobs.get',
        invoke: () =>
          sdk.management.buckets.emptyJobs.get({
            project,
            bucket,
            jobId: 'job-id',
          }),
        method: 'GET',
        path: `/v2/management/projects/${project}/buckets/${bucket}/empty-jobs/job-id`,
      },
      {
        name: 'buckets.emptyJobs.retry',
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
      {
        name: 'files.list',
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
      {
        name: 'files.lookup',
        invoke: () =>
          sdk.management.files.lookup({
            project,
            file: { id: 'file-id' },
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/files/lookup`,
        body: { file: { id: 'file-id' } },
      },
      {
        name: 'files.createDownloadUrls',
        invoke: () =>
          sdk.management.files.createDownloadUrls({
            project,
            files: [{ id: 'file-id' }],
            expiresIn: 60,
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/files/download-urls`,
        body: { files: [{ id: 'file-id' }], expiresIn: 60 },
      },
      {
        name: 'files.delete',
        invoke: () =>
          sdk.management.files.delete({
            project,
            files: [{ id: 'file-id' }],
          }),
        method: 'POST',
        path: `/v2/management/projects/${project}/files/delete`,
        body: { files: [{ id: 'file-id' }] },
      },
      {
        name: 'uploads.request',
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
      {
        name: 'uploads.get',
        invoke: () => sdk.management.uploads.get({ project, uploadId }),
        method: 'GET',
        path: `/v2/management/projects/${project}/uploads/${uploadId}`,
      },
      {
        name: 'uploads.cancel',
        invoke: () => sdk.management.uploads.cancel({ project, uploadId }),
        method: 'DELETE',
        path: `/v2/management/projects/${project}/uploads/${uploadId}`,
      },
      {
        name: 'uploads.createParts',
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
      {
        name: 'uploads.completeMultipart',
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
    ];

    for (const testCase of cases) {
      requests.length = 0;
      await testCase.invoke();
      expect(requests, testCase.name).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, testCase.name).toBe(testCase.method);
      const url = new URL(request.url);
      expect(`${url.pathname}${url.search}`, testCase.name).toBe(testCase.path);
      if (testCase.body !== undefined) {
        await expect(request.json(), testCase.name).resolves.toEqual(
          testCase.body,
        );
      }
    }
  });
});
