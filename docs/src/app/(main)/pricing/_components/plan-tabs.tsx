'use client';

import { cn } from '@/lib/utils';
import { Children, useId, useRef, useState, type ReactNode } from 'react';

export function PlanTabs(props: {
  tabs: { name: string; price: string }[];
  defaultIndex: number;
  children: ReactNode;
}) {
  const { tabs, children } = props;
  const [active, setActive] = useState(props.defaultIndex);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();

  const select = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    setActive(next);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div className="sticky top-(--site-header-height) z-10 -mx-8 bg-site-bg/90 px-8 py-3 backdrop-blur-lg max-[601px]:-mx-5 max-[601px]:px-5">
        <div
          role="tablist"
          aria-label="Plans"
          className="grid grid-cols-3 gap-1 rounded-xl border border-site-line bg-site-panel p-1"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') select(active + 1);
            if (event.key === 'ArrowLeft') select(active - 1);
          }}
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.name}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={index === active}
              aria-controls={`${id}-panel-${index}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => setActive(index)}
              className={cn(
                'flex flex-col items-center rounded-[9px] p-2 leading-[1.35]',
                index === active
                  ? 'bg-site-bg text-site-text shadow-[0_0_0_1px_var(--site-line),0_1px_3px_#0000000f]'
                  : 'text-site-muted hover:text-site-text',
              )}
            >
              <span className="text-sm font-semibold">{tab.name}</span>
              <span className="text-xs tabular-nums">{tab.price}/mo</span>
            </button>
          ))}
        </div>
      </div>
      {Children.toArray(children).map((panel, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={index !== active}
          className="mt-1"
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
