import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliRuntime, GlobalFlags } from './runtime';
import {
  createUploadProgressDisplay,
  UploadProgressDisplay,
  type UploadProgressOutput,
} from './uploadProgress';

describe('UploadProgressDisplay', () => {
  afterEach(() => vi.useRealTimers());

  it('redraws phase changes and ignores duplicate progress events', () => {
    vi.useFakeTimers();
    const { done, live } = fakeLiveOutput();
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
    vi.advanceTimersByTime(80);
    display.update(0, {
      transferredBytes: 50,
      totalBytes: 100,
      percentage: 50,
      phase: 'uploading',
    });
    vi.advanceTimersByTime(80);
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
    vi.advanceTimersByTime(80);

    expect(live).toHaveBeenCalledTimes(4);
    expect(live.mock.calls[1]?.[0]).toContain('0 B / 100 B · uploading');
    expect(live.mock.calls[2]?.[0]).toContain('50% · 50 B / 100 B');
    expect(live.mock.calls[3]?.[0]).toContain('100 B / 100 B · processing');

    display.succeed(0);
    expect(live.mock.lastCall?.[0]).toBe('◆ archive.zip uploaded · 100 B');

    display.close();
    expect(done).toHaveBeenCalledOnce();
  });

  it('keeps rows in input order as uploads finish', () => {
    vi.useFakeTimers();
    const { done, live } = fakeLiveOutput();
    const display = new UploadProgressDisplay(live, false);

    display.start(0, 'first.zip', 100);
    display.start(1, 'second.zip', 200);
    display.start(2, 'third.zip', 300);
    display.succeed(2);
    display.succeed(1);

    const rows = String(live.mock.lastCall?.[0]).split('\n');
    expect(rows[0]).toContain('first.zip');
    expect(rows[1]).toBe('◆ second.zip uploaded · 200 B');
    expect(rows[2]).toBe('◆ third.zip uploaded · 300 B');

    display.close();

    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses familiar labels for binary-scaled file sizes', () => {
    vi.useFakeTimers();
    const { live } = fakeLiveOutput();
    const display = new UploadProgressDisplay(live, false);

    display.start(0, 'archive.zip', 8 * 1024 * 1024);
    display.succeed(0);

    expect(live.mock.lastCall?.[0]).toBe('◆ archive.zip uploaded · 8 MB');
    display.close();
  });

  it('does not render live progress when stderr is redirected', () => {
    const write = vi.fn(() => true);
    const runtime = {
      env: {},
      io: {
        stderr: { write },
        outputIsTty: true,
        stderrIsTty: false,
      },
    } as unknown as CliRuntime;
    const flags: GlobalFlags = {
      color: false,
      progress: true,
    };
    const display = createUploadProgressDisplay(runtime, flags);

    display.start(0, 'archive.zip', 100);
    display.succeed(0);
    display.close();

    expect(write).not.toHaveBeenCalled();
  });

  it('renders live progress when stdout is redirected but stderr is a TTY', () => {
    const write = vi.fn(() => true);
    const runtime = {
      env: {},
      io: {
        stderr: { write },
        outputIsTty: false,
        stderrIsTty: true,
      },
    } as unknown as CliRuntime;
    const flags: GlobalFlags = {
      color: false,
      progress: true,
    };
    const display = createUploadProgressDisplay(runtime, flags);

    display.start(0, 'archive.zip', 100);
    display.succeed(0);
    display.close();

    expect(write).toHaveBeenCalled();
  });
});

function fakeLiveOutput() {
  const clear = vi.fn();
  const persist = vi.fn();
  const done = vi.fn();
  const live = Object.assign(vi.fn(), {
    clear,
    done,
    persist,
  }) as unknown as UploadProgressOutput & ReturnType<typeof vi.fn>;
  return { clear, done, live, persist };
}
