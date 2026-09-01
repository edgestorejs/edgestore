import { describe, expect, it, vi } from 'vitest';
import { classifyCredentials } from '../credentials';
import { MIN_MULTIPART_PART_SIZE_BYTES } from '../uploadTypes';
import { uploadParts } from './multipartUpload';
import { createTransport } from './transport';

describe('uploadParts', () => {
  it('aggregates interleaved part progress monotonically', async () => {
    const totalBytes = MIN_MULTIPART_PART_SIZE_BYTES + 1;
    const progress = vi.fn();
    let releasePartOne: (() => void) | undefined;
    let releasePartTwo: (() => void) | undefined;
    const partOneStarted = new Promise<void>((resolve) => {
      releasePartOne = resolve;
    });
    const partTwoStarted = new Promise<void>((resolve) => {
      releasePartTwo = resolve;
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      const partNumber = request.url.endsWith('1') ? 1 : 2;
      const reader = request.body?.getReader();
      if (!reader) throw new Error('Expected a multipart request body.');

      await reader.read();
      if (partNumber === 1) {
        releasePartOne?.();
        await partTwoStarted;
      } else {
        releasePartTwo?.();
        await partOneStarted;
      }
      while (!(await reader.read()).done) {
        // Consume the remaining request body to drive progress updates.
      }

      return new Response(null, {
        status: 200,
        headers: { etag: `etag-${partNumber}` },
      });
    });
    const transport = createTransport({
      credentials: classifyCredentials({ token: 'management-token' }),
      fetch,
    });

    const completed = await uploadParts(transport, {
      body: new Blob([new Uint8Array(totalBytes)]),
      uploadId: 'upload_123',
      parts: [
        { partNumber: 1, signedUrl: 'https://storage.example/part-1' },
        { partNumber: 2, signedUrl: 'https://storage.example/part-2' },
      ],
      partSizeBytes: MIN_MULTIPART_PART_SIZE_BYTES,
      concurrency: 2,
      onProgress: progress,
    });

    expect(completed).toEqual([
      { partNumber: 1, eTag: 'etag-1' },
      { partNumber: 2, eTag: 'etag-2' },
    ]);
    const transferredBytes = progress.mock.calls.map(
      ([event]) => event.transferredBytes,
    );
    expect(transferredBytes.at(-1)).toBe(totalBytes);
    for (const [index, value] of transferredBytes.entries()) {
      if (index === 0) continue;
      expect(value).toBeGreaterThanOrEqual(transferredBytes[index - 1] ?? 0);
    }
  });
});
