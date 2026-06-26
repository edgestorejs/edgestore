import { describe, expect, it } from 'vitest';
import { createPathParamProxy } from './createPathParamProxy';

describe('createPathParamProxy', () => {
  it('returns the selected context path when called', () => {
    const proxy = createPathParamProxy();

    expect(proxy.ctx.userId()).toBe('ctx.userId');
  });

  it('returns nested input paths when called', () => {
    const proxy = createPathParamProxy();

    expect(proxy.input.org.slug()).toBe('input.org.slug');
  });

  it('returns an empty string when the root proxy is called', () => {
    const proxy = createPathParamProxy();

    expect(proxy()).toBe('');
  });
});
