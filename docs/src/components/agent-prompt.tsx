'use client';

import { Button } from '@/components/ui/button';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export function AgentPrompt({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (status !== 'copied') return;
    const timeout = window.setTimeout(() => setStatus('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copyPrompt() {
    if (!content.current) return;
    try {
      await navigator.clipboard.writeText(content.current.innerText.trim());
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="my-6 rounded-xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
      <div
        ref={content}
        className="text-base leading-relaxed break-words text-foreground select-text [&_a]:font-normal [&_p]:my-0 [&_p+p]:mt-3"
      >
        {children}
      </div>
      <div className="not-prose mt-5 flex flex-wrap items-center justify-end gap-3">
        <span role="status" className="text-sm text-muted-foreground">
          {status === 'error' &&
            'Could not copy. Select the prompt to copy it.'}
          <span className="sr-only">
            {status === 'copied' && 'Prompt copied.'}
          </span>
        </span>
        <Button
          type="button"
          onClick={() => void copyPrompt()}
          className="min-h-10 shadow-none dark:text-background"
        >
          {status === 'copied' ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {status === 'copied' ? 'Copied' : 'Copy prompt'}
        </Button>
      </div>
    </div>
  );
}
