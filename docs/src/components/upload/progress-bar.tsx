import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * Props for the ProgressBar component.
 *
 * @interface ProgressBarProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The progress value as a percentage (0-100).
   */
  progress: number;
}

/**
 * A horizontal progress bar component that visualizes completion percentage.
 *
 * @component
 * @example
 * ```tsx
 * <ProgressBar progress={75} />
 * ```
 */
const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ progress, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative h-0', className)} {...props}>
        <div className="bg-muted absolute top-1 h-1 w-full overflow-clip rounded-full">
          <div
            className="h-full bg-white transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  },
);
ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
