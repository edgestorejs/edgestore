import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './apiUrl';

describe('resolveApiUrl', () => {
  it('uses the hosted API by default', () => {
    expect(resolveApiUrl(undefined, undefined)).toEqual({
      displayUrl: 'https://api.edgestore.dev',
      sdkBaseUrl: 'https://api.edgestore.dev/v2',
    });
  });

  it('prefers the flag and accepts an existing v2 suffix', () => {
    expect(
      resolveApiUrl('http://localhost:4000/v2/', 'http://localhost:3000'),
    ).toEqual({
      displayUrl: 'http://localhost:4000',
      sdkBaseUrl: 'http://localhost:4000/v2',
    });
  });

  it('rejects URLs with an unsupported path', () => {
    expect(() => resolveApiUrl('https://example.com/api', undefined)).toThrow(
      'must be an origin or end in /v2',
    );
  });

  it('rejects credentials embedded in the URL', () => {
    expect(() => resolveApiUrl('https://token@example.com', undefined)).toThrow(
      'must not contain credentials',
    );
  });
});
