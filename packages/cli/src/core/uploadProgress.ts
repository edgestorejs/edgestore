import type { UploadProgress } from '@edgestore/sdk';
import { createLogUpdate } from 'log-update';
import { createColors } from 'picocolors';
import type { CliRuntime, GlobalFlags } from './runtime';

const SPINNER_FRAMES = ['◒', '◐', '◓', '◑'];
const BAR_WIDTH = 18;

export type UploadProgressOutput = ReturnType<typeof createLogUpdate>;

type UploadEntry = {
  fileName: string;
  totalBytes: number;
  progress: UploadProgress;
  status: 'active' | 'succeeded' | 'failed' | 'canceled';
};

export class UploadProgressDisplay {
  private readonly entries = new Map<number, UploadEntry>();
  private readonly colors;
  private timer: NodeJS.Timeout | undefined;
  private frame = 0;

  constructor(
    private readonly live: UploadProgressOutput,
    color: boolean,
  ) {
    this.colors = createColors(color);
  }

  start(id: number, fileName: string, totalBytes: number): void {
    this.entries.set(id, {
      fileName,
      totalBytes,
      progress: {
        transferredBytes: 0,
        totalBytes,
        percentage: 0,
        phase: 'preparing',
      },
      status: 'active',
    });
    this.startTimer();
    this.render();
  }

  update(id: number, progress: UploadProgress): void {
    const entry = this.entries.get(id);
    if (entry?.status !== 'active' || sameProgress(entry.progress, progress))
      return;
    entry.progress = progress;
  }

  succeed(id: number): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.status = 'succeeded';
    this.afterEntryFinished();
  }

  fail(id: number, canceled: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.status = canceled ? 'canceled' : 'failed';
    this.afterEntryFinished();
  }

  close(): void {
    this.stopTimer();
    this.render();
    this.live.done();
    this.entries.clear();
  }

  private startTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.frame = (this.frame + 1) % SPINNER_FRAMES.length;
      this.render();
    }, 80);
    this.timer.unref();
  }

  private stopTimer(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private afterEntryFinished(): void {
    if (
      [...this.entries.values()].every((entry) => entry.status !== 'active')
    ) {
      this.stopTimer();
    }
    this.render();
  }

  private render(): void {
    if (!this.entries.size) {
      this.live.clear();
      return;
    }
    const spinner = this.colors.magenta(SPINNER_FRAMES[this.frame] ?? '◒');
    this.live(
      [...this.entries.values()]
        .map((entry) => renderEntry(entry, spinner, this.colors))
        .join('\n'),
    );
  }
}

export function createUploadProgressDisplay(
  runtime: CliRuntime,
  flags: GlobalFlags,
): UploadProgressDisplay | undefined {
  const enabled =
    flags.progress && !flags.json && !flags.plain && runtime.io.stderrIsTty;
  if (!enabled) return undefined;
  return new UploadProgressDisplay(
    createLogUpdate(runtime.io.stderr, {
      showCursor: true,
      defaultWidth: 80,
    }),
    flags.color && runtime.env.NO_COLOR === undefined,
  );
}

function renderEntry(
  entry: UploadEntry,
  spinner: string,
  colors: ReturnType<typeof createColors>,
): string {
  if (entry.status === 'succeeded') {
    return `${colors.green('◆')} ${entry.fileName} ${colors.green('uploaded')} · ${formatBytes(entry.totalBytes)}`;
  }
  if (entry.status !== 'active') {
    return `${colors.red('■')} ${entry.fileName} ${colors.red(entry.status)}`;
  }

  const { progress } = entry;
  const percentage = Math.max(0, Math.min(100, progress.percentage));
  const completed = Math.round((percentage / 100) * BAR_WIDTH);
  const bar = `${colors.magenta('━'.repeat(completed))}${colors.dim('─'.repeat(BAR_WIDTH - completed))}`;
  const transfer = `${formatBytes(progress.transferredBytes)} / ${formatBytes(progress.totalBytes)}`;
  return `${spinner} ${entry.fileName}  ${bar} ${formatPercentage(percentage)} · ${transfer} · ${progress.phase}`;
}

function sameProgress(left: UploadProgress, right: UploadProgress): boolean {
  return (
    left.transferredBytes === right.transferredBytes &&
    left.totalBytes === right.totalBytes &&
    left.percentage === right.percentage &&
    left.phase === right.phase
  );
}

function formatPercentage(percentage: number): string {
  return `${Number(percentage.toFixed(2))}%`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0] ?? 'KB';
  for (const candidate of units.slice(1)) {
    if (value < 1024) break;
    value /= 1024;
    unit = candidate;
  }
  const precision = value >= 10 ? 0 : 1;
  return `${Number(value.toFixed(precision))} ${unit}`;
}
