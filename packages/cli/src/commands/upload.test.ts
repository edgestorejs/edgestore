import { describe, expect, it, vi } from 'vitest';
import { readExactly } from './upload';

describe('readExactly', () => {
  it('continues after recoverable short reads', async () => {
    const chunks = [Buffer.from('ab'), Buffer.from('cde')];
    const read = vi.fn(async (...args: [Buffer, number, number, number]) => {
      const [buffer, offset] = args;
      const chunk = chunks.shift() ?? Buffer.alloc(0);
      chunk.copy(buffer, offset);
      return { bytesRead: chunk.length, buffer };
    });
    const buffer = Buffer.alloc(5);

    await readExactly({ read }, buffer, 12);

    expect(buffer.toString()).toBe('abcde');
    expect(read).toHaveBeenNthCalledWith(1, buffer, 0, 5, 12);
    expect(read).toHaveBeenNthCalledWith(2, buffer, 2, 3, 14);
  });

  it('fails when EOF arrives before the planned byte range', async () => {
    const read = vi.fn(async (buffer: Buffer) => ({ bytesRead: 0, buffer }));

    await expect(
      readExactly({ read }, Buffer.alloc(1), 0),
    ).rejects.toMatchObject({ code: 'upload_source_changed' });
  });
});
