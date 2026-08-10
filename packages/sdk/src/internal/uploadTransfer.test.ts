import { describe, expect, it, vi } from 'vitest';
import { classifyCredentials } from '../credentials';
import { createTransport } from './transport';
import { putWithRetry } from './uploadTransfer';

describe('putWithRetry', () => {
  it('preserves nested Blob read errors without retrying', async () => {
    const blobReadError = new DOMException(
      'The source changed while being read.',
      'NotReadableError',
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('fetch failed', { cause: blobReadError });
    });
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    await expect(
      putWithRetry(transport, {
        url: 'https://storage.example/upload',
        body: new Blob(['content']),
        uploadId: 'upload_123',
      }),
    ).rejects.toBe(blobReadError);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
