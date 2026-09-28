'use client';

import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { siteButton, sitePrimaryButton } from '../../_components/styles';

export const SETUP_PROMPT =
  'Read https://edgestore.dev/SKILL.md and add file uploads to this application using @edgestore packages from the @rc tag.';

export function SetupPrompt() {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const fallback = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status !== 'copied') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === 'failed') {
      fallback.current?.focus();
      fallback.current?.select();
    }
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SETUP_PROMPT);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <>
      <div className="mt-6 flex items-center gap-5 rounded-[11px] border border-[color-mix(in_srgb,var(--site-accent)_45%,var(--site-line))] bg-site-bg p-2 max-[981px]:flex-col max-[981px]:items-stretch max-[981px]:gap-4 max-[981px]:p-4">
        <p className="flex-1 px-4 font-mono text-[13px] leading-[1.8] wrap-anywhere max-[981px]:p-0 max-[601px]:text-xs">
          {SETUP_PROMPT}
        </p>
        <button
          type="button"
          className={cn(
            siteButton,
            sitePrimaryButton,
            'shrink-0 max-[981px]:self-end max-[601px]:w-full max-[601px]:text-sm',
          )}
          onClick={() => void copy()}
        >
          {status === 'copied' ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Copy size={18} aria-hidden="true" />
          )}
          {status === 'copied' ? 'Prompt copied' : 'Copy setup prompt'}
        </button>
      </div>
      <p
        role="status"
        className={
          status === 'failed' ? 'pt-3 text-[13px] text-site-muted' : 'sr-only'
        }
      >
        {status === 'copied'
          ? 'Setup prompt copied.'
          : status === 'failed'
            ? 'Clipboard unavailable. Copy the selected prompt below.'
            : ''}
      </p>
      {status === 'failed' && (
        <textarea
          ref={fallback}
          readOnly
          value={SETUP_PROMPT}
          aria-label="Setup prompt to copy manually"
          className="mt-3 w-full resize-y rounded-lg border border-site-accent bg-site-panel p-4 font-mono text-[13px] leading-[1.7] text-site-text"
          rows={3}
        />
      )}
    </>
  );
}
