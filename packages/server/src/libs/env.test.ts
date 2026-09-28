import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnv } from './env';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each([
  'ACCESS_KEY',
  'SECRET_KEY',
  'JWT_SECRET',
  'BASE_URL',
  'API_ENDPOINT',
])('%s environment configuration', (suffix) => {
  const name = `EDGESTORE_${suffix}`;
  const legacy = `EDGE_STORE_${suffix}`;

  it('falls back to existing configuration and prefers the canonical name', () => {
    vi.stubEnv(name, undefined);
    vi.stubEnv(legacy, undefined);
    expect(getEnv(name)).toBeUndefined();
    vi.stubEnv(legacy, 'existing');
    expect(getEnv(name)).toBe('existing');
    vi.stubEnv(name, 'canonical');
    expect(getEnv(name)).toBe('canonical');
    vi.stubEnv(name, '');
    expect(getEnv(name)).toBe('');
  });
});

it('leaves other environment names unchanged', () => {
  vi.stubEnv('ES_AWS_REGION', 'test-region');
  expect(getEnv('ES_AWS_REGION')).toBe('test-region');
});
