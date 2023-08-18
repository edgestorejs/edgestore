import React from 'react';
import { twMerge } from 'tailwind-merge';
import { Button } from '../ui/Button';

export function CollapsibleCode({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <div
        className={twMerge(
          'overflow-hidden transition-all duration-300 ease-in-out',
          isOpen ? 'max-h-none' : 'max-h-96',
        )}
      >
        {children}
      </div>
      {!isOpen ? (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-b from-zinc-700/30 to-black" />
          <div className="absolute left-0 right-0 bottom-0 flex h-40 items-center justify-center">
            <Button
              onClick={() => {
                setIsOpen(true);
              }}
            >
              Expand
            </Button>
          </div>
        </>
      ) : (
        <div className="-mt-6 flex items-center justify-center bg-gradient-to-b from-zinc-700/30 to-zinc-900/50 py-4">
          <Button
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Collapse
          </Button>
        </div>
      )}
    </div>
  );
}
