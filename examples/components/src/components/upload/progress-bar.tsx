import { cn } from '@/lib/utils';
import * as React from 'react';

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: number; // Percentage (0-100)
}

const ProgressBar = React.forwardRef<HTMLDivElement, ProgressBarProps>(
  ({ progress, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative h-0', className)} {...props}>
        <div className="bg-muted absolute top-1 h-1 w-full overflow-clip rounded-full">
          <div
            className="h-full bg-primary transition-all duration-300 ease-in-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  },
);
ProgressBar.displayName = 'ProgressBar';

export { ProgressBar };
