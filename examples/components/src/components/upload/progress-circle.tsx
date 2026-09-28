import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for the ProgressCircle component.
 */
export type ProgressCircleProps = React.ComponentProps<'div'> & {
  /**
   * The progress value as a percentage (0-100).
   */
  progress: number;

  /**
   * The diameter of the circle in pixels.
   * @default 48
   */
  size?: number;

  /**
   * The width of the progress stroke in pixels.
   * @default 4
   */
  strokeWidth?: number;

  /**
   * Whether to show the percentage in the middle.
   * @default true
   */
  showValue?: boolean;
};

/**
 * A circular progress indicator. It draws with `currentColor`,
 * so set the color with a text class.
 *
 * @example
 * ```tsx
 * <ProgressCircle progress={75} className="text-white" />
 * <ProgressCircle progress={50} size={64} strokeWidth={6} />
 * ```
 */
function ProgressCircle({
  progress,
  size = 48,
  strokeWidth = 4,
  showValue = true,
  className,
  style,
  ...props
}: ProgressCircleProps) {
  const value = Math.min(100, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn('relative grid place-items-center', className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="fill-none stroke-current opacity-25"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          className="fill-none stroke-current transition-[stroke-dashoffset] duration-150 ease-linear motion-reduce:transition-none"
        />
      </svg>
      {showValue && (
        <span className="text-xs font-medium tabular-nums">
          {Math.round(value)}%
        </span>
      )}
    </div>
  );
}

export { ProgressCircle };
