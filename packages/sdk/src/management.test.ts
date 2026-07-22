import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ManagementClient } from './management';
import { createEdgeStoreSdk } from './sdk';

function createManagementSdk(fetch: typeof globalThis.fetch) {
  return createEdgeStoreSdk({
    credentials: { token: 'management-token' },
    baseUrl: 'https://example.com/v2',
    fetch,
  });
}

describe('management resources', () => {
  it('maps project creation and idempotency to the API contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe('POST');
      expect(request.url).toBe(
        'https://example.com/v2/management/accounts/account-id/projects',
      );
      expect(request.headers.get('idempotency-key')).toBe('project-request');
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
      idempotencyKey: 'project-request',
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

  it('returns undefined for successful empty responses', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response(null, { status: 204 }),
    );
    const sdk = createManagementSdk(fetch);

    await expect(
      sdk.management.projects.delete({ project: 'project-id' }),
    ).resolves.toBeUndefined();
  });
});
