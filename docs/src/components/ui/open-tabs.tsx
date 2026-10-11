'use client';

import { cn } from '@/lib/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

const OpenTabs = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>((props, ref) => {
  const root = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let frame = 0;
    function revealAnchor() {
      const target = document.getElementById(window.location.hash.slice(1));
      if (!target || !root.current?.contains(target)) return;
      const panel = target.closest('[role="tabpanel"]');
      if (panel?.getAttribute('data-state') !== 'inactive') return;

      const trigger = Array.from(
        root.current.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
      ).find((tab) => tab.getAttribute('aria-controls') === panel.id);
      // Radix activates a tab when its trigger receives focus.
      trigger?.focus();
      frame = requestAnimationFrame(() => target.scrollIntoView());
    }

    function onAnchorClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor =
        event.target instanceof Element ? event.target.closest('a') : null;
      // Clicking the current anchor does not emit another hashchange.
      if (anchor?.href === window.location.href) revealAnchor();
    }

    revealAnchor();
    window.addEventListener('hashchange', revealAnchor);
    document.addEventListener('click', onAnchorClick);
    return () => {
      window.removeEventListener('hashchange', revealAnchor);
      document.removeEventListener('click', onAnchorClick);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <TabsPrimitive.Root
      {...props}
      ref={(element) => {
        root.current = element;
        if (typeof ref === 'function') return ref(element);
        if (ref) ref.current = element;
      }}
    />
  );
});
OpenTabs.displayName = TabsPrimitive.Root.displayName;

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

const OpenTabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    forceMount
    className={cn(
      'relative mt-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none data-[state=inactive]:hidden [&_h3.font-heading]:text-base [&_h3.font-heading]:font-semibold',
      className,
    )}
    {...props}
  />
));
OpenTabsContent.displayName = TabsPrimitive.Content.displayName;

export { OpenTabs, OpenTabsList, OpenTabsTrigger, OpenTabsContent };
