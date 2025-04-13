import { cn } from '@/lib/utils';
import * as React from 'react';

/**
 * Props for the ProgressCircle component.
 *
 * @interface ProgressCircleProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface ProgressCircleProps
  extends React.HTMLAttributes<HTMLDivElement> {
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
}

/**
 * A circular progress indicator component that visualizes completion percentage.
 *
 * @component
 * @example
 * ```tsx
 * <ProgressCircle progress={75} />
 * <ProgressCircle progress={50} size={64} strokeWidth={6} />
 * ```
 */
const ProgressCircle = React.forwardRef<HTMLDivElement, ProgressCircleProps>(
  ({ progress, size = 48, strokeWidth = 4, className, ...props }, ref) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex flex-col items-center justify-center text-white',
          className,
        )}
        style={{
          width: size,
          height: size,
        }}
        {...props}
      >
        <svg
          className="absolute" // Position SVG centered relative to the div
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }} // Start from top
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-gray-500"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="fill-none stroke-white"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.3s ease' }} // Smooth transition
          />
        </svg>
        {/* Progress Percentage Text (centered visually) */}
        <div className="z-10 text-xs font-medium">{Math.round(progress)}%</div>
      </div>
    );
  },
);
ProgressCircle.displayName = 'ProgressCircle';

export { ProgressCircle };
