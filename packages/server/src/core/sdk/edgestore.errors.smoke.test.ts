import { describe, expect, it } from 'vitest';
import {
  getSmokeApiEndpoint,
  getSmokeBasicAuthHeader,
  getSmokeBucketName,
  requireSmokeCredentials,
} from '../../test-utils/edgestoreSmoke';

type EdgeStoreErrorJson = {
  code?: string;
  message?: string;
  details?: unknown;
};

function smokeApiUrl(path: string) {
  return new URL(path, getSmokeApiEndpoint()).toString();
}

async function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return await fetch(smokeApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function parseJsonBody(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as EdgeStoreErrorJson;
  } catch {
    throw new Error(
      `Expected JSON response, got ${res.status} ${res.statusText}: ${text}`,
    );
  }
}

const validRequestUploadBody = {
  bucketType: 'FILE',
  extension: 'txt',
  isPublic: true,
  isTemporary: true,
  metadata: {},
  mimeType: 'text/plain',
  path: [],
  size: 12,
};

describe('EdgeStore API deployed error contract smoke test', () => {
  it('authenticates protected routes before body validation', async () => {
    const res = await postJson('/request-upload', {
      ...validRequestUploadBody,
      bucketName: getSmokeBucketName(),
    });

    expect(res.status).toBe(401);
    await expect(parseJsonBody(res)).resolves.toMatchObject({
      code: 'UNAUTHORIZED',
      message: expect.any(String),
    });
  });

  it('preserves authenticated input validation error shape', async () => {
    requireSmokeCredentials();

    const res = await postJson(
      '/request-upload',
      {
        bucketName: '',
        bucketType: 'IMAGE',
        path: [],
        size: 1234,
      },
      {
        Authorization: getSmokeBasicAuthHeader(),
      },
    );

    expect(res.status).toBe(400);
    await expect(parseJsonBody(res)).resolves.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'Input validation error',
      details: expect.any(Array),
    });
  });

  it('preserves oversized JSON payload rejection shape', async () => {
    const res = await postJson(
      '/request-upload',
      {
        ...validRequestUploadBody,
        bucketName: getSmokeBucketName(),
        payload: 'x'.repeat(100 * 1024),
      },
      {
        Authorization: getSmokeBasicAuthHeader(),
      },
    );

    expect(res.status).toBe(413);
    await expect(parseJsonBody(res)).resolves.toMatchObject({
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('returns a stable JSON shape for unknown routes', async () => {
    const res = await postJson('/does-not-exist', {});

    expect(res.status).toBe(404);
    await expect(parseJsonBody(res)).resolves.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Route not found',
    });
  });
});
