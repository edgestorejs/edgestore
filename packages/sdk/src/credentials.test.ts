import { describe, expect, it } from 'vitest';
import { getAuthorizationHeader } from './credentials';

describe('getAuthorizationHeader', () => {
  it('encodes project credentials as Basic authentication', () => {
    expect(
      getAuthorizationHeader({ accessKey: 'project', secretKey: 'secret' }),
    ).toBe('Basic cHJvamVjdDpzZWNyZXQ=');
  });

  it('encodes management credentials as Bearer authentication', () => {
    expect(getAuthorizationHeader({ token: 'management-token' })).toBe(
      'Bearer management-token',
    );
  });

  it('rejects empty credentials before making a request', () => {
    expect(() =>
      getAuthorizationHeader({ accessKey: '', secretKey: 'secret' }),
    ).toThrow('accessKey');
  });
});
