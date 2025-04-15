'use client';

import { cn } from '@/lib/utils';
import { MenuIcon } from 'lucide-react';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

const TabsList = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => {
  function Content() {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-muted text-muted-foreground flex flex-col items-start justify-start rounded-lg p-1 sm:inline-flex sm:h-9 sm:flex-row sm:items-center sm:justify-center',
          className,
        )}
        {...props}
      />
    );
  }

  return (
    <>
      <Popover>
        <PopoverTrigger className="block sm:hidden">
          <MenuIcon />
        </PopoverTrigger>
        <PopoverContent
          className="w-auto border-none bg-transparent p-0 sm:hidden"
          align="start"
        >
          <Content />
        </PopoverContent>
      </Popover>
      <div className="hidden sm:block">
        <Content />
      </div>
    </>
  );
});
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & {
    active?: boolean;
  }
>(({ className, active, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'ring-offset-background focus-visible:ring-ring inline-flex w-full items-center justify-start whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm sm:w-auto sm:justify-center',
      active && 'bg-background text-foreground',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export { TabsList, TabsTrigger };
