import { describe, expect, it, vi } from 'vitest';
import { createEdgeStoreSdk } from './sdk';

describe('management access resources', () => {
  it('maps invitation creation and idempotency to the API contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe('POST');
      expect(request.url).toBe(
        'https://example.com/v2/management/accounts/account-id/invitations',
      );
      expect(request.headers.get('idempotency-key')).toBe('invite-request');
      await expect(request.json()).resolves.toEqual({
        email: 'dev@example.com',
        role: 'MEMBER',
      });
      return Response.json({ data: { invitation: { id: 'invitation-id' } } });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { token: 'management-token' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    const result = await sdk.management.invitations.create({
      account: 'account-id',
      email: 'dev@example.com',
      role: 'MEMBER',
      idempotencyKey: 'invite-request',
    });

    expect(result.invitation.id).toBe('invitation-id');
  });

  it('serializes user token pagination without an account selector', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe(
        'https://example.com/v2/management/users/me/tokens?page=2&pageSize=25',
      );
      return Response.json({ data: { tokens: [], pagination: {} } });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { token: 'management-token' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    await sdk.management.tokens.listUser({ page: 2, pageSize: 25 });

    expect(fetch).toHaveBeenCalledOnce();
  });
});
