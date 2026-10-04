'use client';

import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

export function SetupGuide({ children }: { children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let frame: number | undefined;

    function reveal(hash: string) {
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }
      const target = document.getElementById(id);
      if (!target || !details.current?.contains(target)) return;
      details.current.open = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        target.scrollIntoView({ block: 'start' }),
      );
    }

    function onHashChange() {
      reveal(window.location.hash);
    }

    // Also handle clicks on the current hash after the reader closes the guide.
    function onClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download'))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        reveal(url.hash);
      }
    }

    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onClick, true);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

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
