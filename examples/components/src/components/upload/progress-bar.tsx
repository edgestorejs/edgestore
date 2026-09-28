import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for the ProgressBar component.
 */
export type ProgressBarProps = React.ComponentProps<'div'> & {
  /**
   * The progress value as a percentage (0-100).
   */
  progress: number;

  /**
   * Additional className for the filled part of the bar.
   */
  indicatorClassName?: string;
};

/**
 * A horizontal progress bar that visualizes completion percentage.
 *
 * @example
 * ```tsx
 * <ProgressBar progress={75} />
 * <ProgressBar progress={75} className="bg-white/30" indicatorClassName="bg-white" />
 * ```
 */
function ProgressBar({
  progress,
  className,
  indicatorClassName,
  ...props
}: ProgressBarProps) {
  const value = Math.min(100, Math.max(0, progress));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn(
        'h-1 w-full overflow-hidden rounded-full bg-primary/15',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-150 ease-linear motion-reduce:transition-none',
          indicatorClassName,
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export { ProgressBar };
