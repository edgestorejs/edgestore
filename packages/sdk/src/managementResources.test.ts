import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ManagementClient } from './managementClient';
import { createEdgeStoreSdk } from './sdk';

function createManagementSdk(fetch: typeof globalThis.fetch) {
  return createEdgeStoreSdk({
    credentials: { token: 'management-token' },
    baseUrl: 'https://example.com/v2',
    fetch,
  });
}

describe('management resources', () => {
  it('maps identity lookup to the API contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe('GET');
      expect(request.url).toBe('https://example.com/v2/whoami');
      return Response.json({
        data: { actor: { kind: 'management_token', userId: 'user-id' } },
      });
    });
    const sdk = createManagementSdk(fetch);

    await expect(sdk.management.whoami()).resolves.toEqual({
      actor: { kind: 'management_token', userId: 'user-id' },
    });
    expectTypeOf(sdk.system).not.toHaveProperty('whoami');
  });

  it('maps project creation to the API contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe('POST');
      expect(request.url).toBe(
        'https://example.com/v2/management/accounts/account-id/projects',
      );
      expect(request.headers.has('idempotency-key')).toBe(false);
      await expect(request.json()).resolves.toEqual({
        name: 'Customer portal',
        createKey: true,
      });
      return Response.json({ data: { project: { id: 'project-id' } } });
    });
    const sdk = createManagementSdk(fetch);

    const result = await sdk.management.projects.create({
      account: 'account-id',
      name: 'Customer portal',
      createKey: true,
    });

    expect(result.project.id).toBe('project-id');
    expectTypeOf(sdk.management).toEqualTypeOf<ManagementClient>();
  });

  it('serializes file pagination as query parameters', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe(
        'https://example.com/v2/management/projects/project-id/buckets/documents/files?cursor=next-page&limit=50',
      );
      return Response.json({ data: { files: [], pagination: {} } });
    });
    const sdk = createManagementSdk(fetch);

    await sdk.management.files.list({
      project: 'project-id',
      bucket: 'documents',
      cursor: 'next-page',
      limit: 50,
    });

    expect(fetch).toHaveBeenCalledOnce();
  });

  it('returns the API response for project deletion', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json({ data: {} }),
    );
    const sdk = createManagementSdk(fetch);

    await expect(
      sdk.management.projects.delete({ project: 'project-id' }),
    ).resolves.toEqual({});
  });

  it('returns null when a bucket has no empty-bucket job', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe(
        'https://example.com/v2/management/projects/project-id/buckets/documents/empty-job',
      );
      return Response.json({ data: { job: null } });
    });
    const sdk = createManagementSdk(fetch);

    const result = await sdk.management.buckets.emptyJobs.latest({
      project: 'project-id',
      bucket: 'documents',
    });

    expect(result).toEqual({ job: null });
    expectTypeOf<null>().toMatchTypeOf<typeof result.job>();
  });
});
