'use client';

import { useEffect, useEffectEvent, type RefObject } from 'react';
import { flushSync } from 'react-dom';

/**
 * Calls `reveal` when the URL hash targets an element inside `container`, then
 * scrolls to the target. Use it for content hidden behind collapsed sections or
 * inactive tabs, so direct links and table of contents links still work.
 */
export function useRevealAnchor(
  container: RefObject<HTMLElement | null>,
  reveal: () => void,
) {
  const onReveal = useEffectEvent(reveal);

  useEffect(() => {
    function revealHash(hash: string) {
      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }
      const target = id ? document.getElementById(id) : null;
      if (!target || !container.current?.contains(target)) return;
      if (target.checkVisibility()) return;
      flushSync(onReveal);
      target.scrollIntoView({ block: 'start' });
    }

    function onHashChange() {
      revealHash(window.location.hash);
    }

    // Clicking a link to the current hash does not fire `hashchange`.
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
        revealHash(url.hash);
      }
    }

    // Defer the initial check so `flushSync` runs outside React's commit.
    const timeout = setTimeout(onHashChange);
    window.addEventListener('hashchange', onHashChange);
    document.addEventListener('click', onClick, true);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('hashchange', onHashChange);
      document.removeEventListener('click', onClick, true);
    };
  }, [container]);
}
