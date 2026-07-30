import { cn } from '@/lib/utils';
import * as React from 'react';

const CodeBlock = React.forwardRef<
  HTMLPreElement,
  React.HTMLAttributes<HTMLPreElement>
>(({ className, ...props }, ref) => (
  <pre
    ref={ref}
    className={cn(
      'overflow-x-scroll rounded-sm bg-muted p-2 text-xs',
      className,
    )}
    {...props}
  />
));
CodeBlock.displayName = 'CodeBlock';

export { CodeBlock };
