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
  const content = (
    <>
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

      <span className="relative flex items-center gap-2 dark:text-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
        {children}
      </span>
    </>
  );

  let action = <div>{content}</div>;
  if (href) {
    action = href.startsWith('/') ? (
      <Link href={href} target="_blank" rel="noreferrer">
        {content}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noreferrer">
        {content}
      </a>
    );
  }

  return (
    <Button
      asChild
      size={size}
      className={cn(
        'group relative inline-flex items-center justify-center overflow-hidden bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg transition-all duration-300 hover:shadow-[0_0_30px_rgba(170,153,255,0.4)] dark:text-shadow-[0_2px_4px_rgba(0,0,0,0.5)]',
        className,
      )}
      {...props}
    >
      {action}
    </Button>
  );
}
