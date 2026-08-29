import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  UploadProgressDisplay,
  type UploadProgressOutput,
} from './uploadProgress';

describe('UploadProgressDisplay', () => {
  afterEach(() => vi.useRealTimers());

  it('redraws phase changes and ignores duplicate progress events', () => {
    vi.useFakeTimers();
    const { live, persist } = fakeLiveOutput();
    const display = new UploadProgressDisplay(live, false);

    display.start(0, 'archive.zip', 100);
    display.update(0, {
      transferredBytes: 0,
      totalBytes: 100,
      percentage: 0,
      phase: 'preparing',
    });
    expect(live).toHaveBeenCalledTimes(1);

    display.update(0, {
      transferredBytes: 0,
      totalBytes: 100,
      percentage: 0,
      phase: 'uploading',
    });
    display.update(0, {
      transferredBytes: 50,
      totalBytes: 100,
      percentage: 50,
      phase: 'uploading',
    });
    display.update(0, {
      transferredBytes: 50,
      totalBytes: 100,
      percentage: 50,
      phase: 'uploading',
    });
    display.update(0, {
      transferredBytes: 100,
      totalBytes: 100,
      percentage: 100,
      phase: 'processing',
    });

    expect(live).toHaveBeenCalledTimes(4);
    expect(live.mock.calls[1]?.[0]).toContain('0 B / 100 B · uploading');
    expect(live.mock.calls[2]?.[0]).toContain('50% · 50 B / 100 B');
    expect(live.mock.calls[3]?.[0]).toContain('100 B / 100 B · processing');

    display.succeed(0);
    expect(persist).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledWith('◆ archive.zip uploaded · 100 B');
  });

  it('clears an unfinished live row when the command closes', () => {
    vi.useFakeTimers();
    const { clear, live } = fakeLiveOutput();
    const display = new UploadProgressDisplay(live, false);

    display.start(0, 'archive.zip', 100);
    display.close();

    expect(clear).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

function fakeLiveOutput() {
  const clear = vi.fn();
  const persist = vi.fn();
  const live = Object.assign(vi.fn(), {
    clear,
    done: vi.fn(),
    persist,
  }) as unknown as UploadProgressOutput & ReturnType<typeof vi.fn>;
  return { clear, live, persist };
}
