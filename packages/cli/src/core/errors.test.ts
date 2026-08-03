import { describe, expect, it } from 'vitest';
import { normalizeError } from './errors';

describe('normalizeError', () => {
  it.each([
    new DOMException('The operation was aborted.', 'AbortError'),
    Object.assign(new Error('The operation was aborted.'), {
      name: 'AbortError',
    }),
    Object.assign(new Error('The operation was aborted.'), {
      code: 'ABORT_ERR',
    }),
  ])('normalizes native abort errors as interruptions', (error) => {
    expect(normalizeError(error)).toMatchObject({
      code: 'interrupted',
      message: 'Operation canceled.',
      exitCode: 130,
    });
  });
});
