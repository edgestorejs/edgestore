'use client';

import { useRevealAnchor } from '@/hooks/use-reveal-anchor';
import { ChevronRight } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

export function SetupGuide({ children }: { children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  useRevealAnchor(details, () => {
    if (details.current) details.current.open = true;
  });

  return (
    <details ref={details} className="group/setup my-8 border-y border-border">
      <summary className="not-prose flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-5 text-base font-medium text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        Step-by-step setup
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 group-open/setup:rotate-90"
        />
      </summary>
      <div className="pb-6 [&>h2:first-child]:mt-3">{children}</div>
    </details>
  );
}
