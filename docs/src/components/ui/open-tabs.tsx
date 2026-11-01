'use client';

import { useRevealAnchor } from '@/hooks/use-reveal-anchor';
import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

const SelectTabContext = React.createContext<((value: string) => void) | null>(
  null,
);

function OpenTabs({
  defaultValue,
  ...props
}: Omit<
  React.ComponentProps<typeof TabsPrimitive.Root>,
  'value' | 'onValueChange'
>) {
  const [value, setValue] = React.useState(defaultValue);
  return (
    <SelectTabContext value={setValue}>
      <TabsPrimitive.Root value={value} onValueChange={setValue} {...props} />
    </SelectTabContext>
  );
}

const OpenTabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 w-full items-center justify-start rounded-none border-b bg-transparent p-0 text-muted-foreground',
      className,
    )}
    {...props}
  />
));
OpenTabsList.displayName = TabsPrimitive.List.displayName;

const OpenTabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative inline-flex h-9 cursor-pointer items-center justify-center rounded-none border-b-2 border-b-transparent bg-transparent px-4 py-1 pt-2 pb-3 text-sm font-semibold whitespace-nowrap text-muted-foreground shadow-none ring-offset-background transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-b-primary data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none',
      className,
    )}
    {...props}
  />
));
OpenTabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// Inactive panels stay mounted so links to headings inside them can open them.
function OpenTabsContent({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<typeof TabsPrimitive.Content>, 'forceMount'>) {
  const selectTab = React.use(SelectTabContext);
  const content = React.useRef<HTMLDivElement>(null);
  useRevealAnchor(content, () => selectTab?.(value));

  return (
    <TabsPrimitive.Content
      ref={content}
      value={value}
      forceMount
      className={cn(
        'relative mt-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none data-[state=inactive]:hidden [&_h3.font-heading]:text-base [&_h3.font-heading]:font-semibold',
        className,
      )}
      {...props}
    />
  );
}

export { OpenTabs, OpenTabsList, OpenTabsTrigger, OpenTabsContent };
