import { cn } from '@/lib/utils';
import React from 'react';

export const AnimatedGrid = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) {
      const scrollerContent = Array.from(scroller.children);
      scrollerContent.forEach((item) => {
        const duplicatedItem = item.cloneNode(true) as HTMLElement;
        scroller.appendChild(duplicatedItem);
      });
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'scroller relative z-20 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_20%,white_80%,transparent)]',
        className,
      )}
    >
      <div
        ref={scrollerRef}
        className="animate-scroll flex w-max min-w-full shrink-0 flex-nowrap gap-3 py-4 sm:gap-4"
      >
        {children}
      </div>
    </div>
  );
};

export const AnimatedGridItem = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        'relative w-[320px] max-w-full flex-shrink-0 rounded-2xl border border-slate-700 border-x-slate-700/70 border-b-slate-700/40 px-4 py-5 transition-transform duration-200 ease-in-out hover:scale-105 sm:w-[350px] sm:px-6 sm:py-6 md:w-[420px] md:px-8',
        className,
      )}
      style={{
        background:
          'linear-gradient(180deg, var(--slate-800), var(--slate-900)',
      }}
    >
      <blockquote>{children}</blockquote>
    </div>
  );
};
