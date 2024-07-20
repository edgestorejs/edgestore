import { cn } from '@/lib/utils';
import * as React from 'react';

const CodeBlock = React.forwardRef<
  HTMLPreElement,
  React.HTMLAttributes<HTMLPreElement>
>(({ className, ...props }, ref) => (
  <pre
    ref={ref}
    className={cn(
      'bg-muted overflow-x-scroll rounded-sm p-2 text-xs',
      className,
    )}
    {...props}
  />
));
CodeBlock.displayName = 'CodeBlock';

export { CodeBlock };
