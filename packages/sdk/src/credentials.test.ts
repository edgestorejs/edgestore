import { describe, expect, it } from 'vitest';
import {
  classifyCredentials,
  getAuthorizationHeader,
  type EdgeStoreCredentials,
} from './credentials';

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

  it('classifies an undefined token with project keys as project credentials', () => {
    const credentials: EdgeStoreCredentials = {
      accessKey: 'project',
      secretKey: 'secret',
      token: undefined,
    };

    expect(classifyCredentials(credentials)).toEqual({
      kind: 'project',
      accessKey: 'project',
      secretKey: 'secret',
    });
  });

  it('rejects ambiguous and incomplete credentials', () => {
    expect(() =>
      classifyCredentials({
        token: 'management-token',
        accessKey: 'project',
        secretKey: 'secret',
      } as EdgeStoreCredentials),
    ).toThrow('both');
    expect(() =>
      classifyCredentials({ accessKey: 'project' } as EdgeStoreCredentials),
    ).toThrow('secretKey');
  });
});
