import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import * as React from 'react';

type ActionButtonProps = React.ComponentProps<typeof Button> & {
  href?: string;
};

export function ActionButton({
  href,
  children,
  className,
  size = 'lg',
  ...props
}: ActionButtonProps) {
  const LinkComp = href ? (href.startsWith('/') ? Link : 'a') : 'div';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const linkProps = href
    ? { href, target: '_blank', rel: 'noreferrer' }
    : ({} as any);

  return (
    <Button
      asChild
      size={size}
      className={cn(
        'dark:text-shadow-[0_2px_4px_rgba(0,0,0,0.5)] group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(170,153,255,0.4)]',
        className,
      )}
      {...props}
    >
      <LinkComp {...linkProps}>
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Shimmer effect */}
        <div className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

        <span className="dark:text-shadow-[0_1px_4px_rgba(0,0,0,0.8)] relative flex items-center gap-2">
          {children}
        </span>
      </LinkComp>
    </Button>
  );
}
