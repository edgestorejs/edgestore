import { describe, expect, it } from 'vitest';
import { createFixture } from '../testFixture';
import type { GlobalFlags } from './runtime';
import { isInteractive } from './runtime';

describe('isInteractive', () => {
  it.each([
    { inputIsTty: true, json: false, plain: false, expected: true },
    { inputIsTty: false, json: false, plain: false, expected: false },
    { inputIsTty: true, json: true, plain: false, expected: false },
    { inputIsTty: true, json: false, plain: true, expected: false },
  ])(
    'returns $expected for tty=$inputIsTty json=$json plain=$plain',
    ({ inputIsTty, json, plain, expected }) => {
      const fixture = createFixture();
      fixture.runtime.io.inputIsTty = inputIsTty;
      const flags: GlobalFlags = {
        json,
        plain,
        color: false,
        progress: false,
      };

      expect(isInteractive(fixture.runtime, flags)).toBe(expected);
    },
  );
});
