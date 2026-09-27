'use client';

import type { Result } from '@/lib/actions';
import { useState, type ComponentProps, type ReactNode } from 'react';

export function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm text-white dark:bg-white dark:text-zinc-900">
          {number}
        </span>
        {title}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' }) {
  const styles =
    variant === 'primary'
      ? 'bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200'
      : 'border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800';
  return (
    <button
      type="button"
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

type Outcome = { ok: boolean; text: string; url?: string };

/**
 * Runs one scenario and remembers how it ended, so every step can show a
 * pass/fail line without its own loading and error state.
 */
export function useScenario() {
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();

  async function run(scenario: () => Promise<Outcome>) {
    setRunning(true);
    setOutcome(undefined);
    try {
      setOutcome(await scenario());
    } catch (error) {
      setOutcome({
        ok: false,
        text: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunning(false);
    }
  }

  return { running, outcome, run };
}

export function OutcomeLine({ outcome }: { outcome?: Outcome }) {
  if (!outcome) return null;
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm break-all ${
        outcome.ok
          ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300'
      }`}
    >
      {outcome.ok ? '✓ ' : '✗ '}
      {outcome.text}
      {outcome.url ? (
        <>
          {' '}
          <a
            className="underline"
            href={outcome.url}
            target="_blank"
            rel="noreferrer"
          >
            Open file
          </a>
        </>
      ) : null}
    </p>
  );
}

/** Returns the data of a server action result, or throws its error. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/** Creates a small text file so scenarios work without picking a file. */
export function textFile(name: string, text: string) {
  return new File([text], name, { type: 'text/plain' });
}
