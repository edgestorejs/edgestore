import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

const iconVariants = cva('inline-flex shrink-0', {
  variants: {
    size: {
      xs: 'size-3',
      sm: 'size-4',
      md: 'size-5',
      lg: 'size-6',
      xl: 'size-8',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

export interface IconProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'color' | 'size'>,
    VariantProps<typeof iconVariants> {
  className?: string;
}

export const IconBase = React.forwardRef<SVGSVGElement, IconProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        className={cn(iconVariants({ size, className }))}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        {...props}
      >
        {children}
      </svg>
    );
  },
);

IconBase.displayName = 'IconBase';

export { iconVariants };
