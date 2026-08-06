import { describe, expect, it } from 'vitest';
import {
  isReusableOAuthRedirectUri,
  openOAuthCallbackServer,
} from './oauthCallback';

describe('OAuth loopback callback', () => {
  it('accepts the expected state and ignores mismatched callbacks', async () => {
    const callback = await openOAuthCallbackServer(
      'expected-state',
      new AbortController().signal,
    );

    try {
      const invalid = new URL(callback.redirectUri);
      invalid.searchParams.set('state', 'wrong-state');
      expect((await fetch(invalid)).status).toBe(400);

      const valid = new URL(callback.redirectUri);
      valid.searchParams.set('state', 'expected-state');
      valid.searchParams.set('code', 'code_123');
      const response = await fetch(valid);
      const received = await callback.callback;

      expect(response.status).toBe(200);
      expect(await response.text()).toContain('Logged in to EdgeStore');
      expect(received.searchParams.get('code')).toBe('code_123');
    } finally {
      await callback.close();
    }
  });

  it('only reuses explicit IPv4 loopback callback ports', () => {
    expect(
      isReusableOAuthRedirectUri('http://127.0.0.1:45678/oauth/callback'),
    ).toBe(true);
    expect(isReusableOAuthRedirectUri('http://localhost:45678/callback')).toBe(
      false,
    );
    expect(isReusableOAuthRedirectUri('http://127.0.0.1/callback')).toBe(false);
  });

  it('cancels the pending callback when the server closes early', async () => {
    const callback = await openOAuthCallbackServer(
      'expected-state',
      new AbortController().signal,
    );

    await callback.close();

    await expect(callback.callback).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});
