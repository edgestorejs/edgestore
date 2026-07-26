import { describe, expect, it, vi } from 'vitest';
import type { SystemOperationId } from './internal/operationTypes';
import { createEdgeStoreSdk } from './sdk';

type MappingCase = {
  invoke: () => Promise<unknown>;
  method: string;
  path: string;
  result: unknown;
};

describe('system resources', () => {
  it('maps every system operation to its HTTP contract', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      requests.push(request);
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
    const cases = {
      'v2.health': {
        invoke: () => sdk.system.health(),
        method: 'GET',
        path: '/v2/health',
        result: { ok: true, version: 'v2' },
      },
      'v2.whoami': {
        invoke: () => sdk.system.whoami(),
        method: 'GET',
        path: '/v2/whoami',
        result: {
          actor: { kind: 'project_key', projectId: 'project-id' },
        },
      },
    } satisfies Record<SystemOperationId, MappingCase>;

    for (const [operationId, testCase] of Object.entries(cases)) {
      requests.length = 0;
      await expect(testCase.invoke()).resolves.toEqual(testCase.result);
      expect(requests, operationId).toHaveLength(1);
      const request = requests[0]!;
      expect(request.method, operationId).toBe(testCase.method);
      expect(new URL(request.url).pathname, operationId).toBe(testCase.path);
    }
  });
});
