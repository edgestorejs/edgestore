'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

const prompt =
  'Read https://edgestore.dev/SKILL.md and add file uploads to this application.';

export function CopyPrompt() {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    if (state !== 'copied') return;
    const timeout = window.setTimeout(() => setState('idle'), 2500);
    return () => window.clearTimeout(timeout);
  }, [state]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setState('copied');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="ll-copy">
      <p className="ll-prompt-text">{prompt}</p>
      <button className="ll-primary" type="button" onClick={() => void copy()}>
        {state === 'copied' ? <Check size={18} /> : <Copy size={18} />}
        {state === 'copied' ? 'Prompt copied' : 'Copy setup prompt'}
      </button>
      <span
        role="status"
        className={state === 'error' ? 'll-copy-error' : 'll-sr-only'}
      >
        {state === 'error'
          ? 'Could not copy. Select and copy the prompt above.'
          : state === 'copied'
            ? 'Prompt copied. Paste it into your coding agent.'
            : ''}
      </span>
    </div>
  );
}
