'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export const SETUP_PROMPT =
  'Read https://edgestore.dev/SKILL.md and add file uploads to this application.';

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
      <div className="ya-prompt">
        <p>{SETUP_PROMPT}</p>
        <button
          type="button"
          className="ya-button ya-primary"
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
        className={status === 'failed' ? 'ya-copy-feedback' : 'ya-sr-only'}
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
          className="ya-prompt-fallback"
          rows={3}
        />
      )}
    </>
  );
}
