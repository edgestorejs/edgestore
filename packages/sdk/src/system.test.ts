import { describe, expect, it, vi } from 'vitest';
import { createEdgeStoreSdk } from './sdk';

describe('system resources', () => {
  it('exposes health and authenticated actor checks', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.url.endsWith('/health')) {
        return Response.json({ data: { ok: true, version: 'v2' } });
      }
      return Response.json({
        data: { actor: { kind: 'project_key', projectId: 'project-id' } },
      });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    await expect(sdk.system.health()).resolves.toEqual({
      ok: true,
      version: 'v2',
    });
    await expect(sdk.system.whoami()).resolves.toMatchObject({
      actor: { kind: 'project_key' },
    });
  });
});
