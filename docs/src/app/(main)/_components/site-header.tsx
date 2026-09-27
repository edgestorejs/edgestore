'use client';

import { useAppContext } from '@/components/app-context-provider';
import { cn } from '@/lib/utils';
import { Menu, Moon, Star, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { siteContainer } from './styles';

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      className="inline-flex shrink-0 [&_img]:h-[30px] [&_img]:w-auto max-[821px]:[&_img]:h-[26px]"
      aria-label="EdgeStore home"
      onClick={onNavigate}
    >
      <Image
        src="/img/edgestore-lockup-light.svg"
        alt=""
        width={220}
        height={32}
        className="dark:hidden"
        priority
      />
      <Image
        src="/img/edgestore-lockup.svg"
        alt=""
        width={220}
        height={32}
        className="hidden dark:block"
        priority
      />
    </Link>
  );
}

export function SiteHeader({ dashboardUrl }: { dashboardUrl: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const { setTheme, resolvedTheme } = useTheme();
  const { githubStars } = useAppContext();

  return (
    <header className="sticky top-0 z-30 border-b border-site-line bg-site-bg/90 backdrop-blur-lg">
      <a
        href="#main"
        className="absolute -top-[100px] left-5 z-10 rounded-md bg-site-panel px-4 py-3 no-underline focus:top-[15px]"
      >
        Skip to content
      </a>
      <div
        className={cn(
          siteContainer,
          'flex h-(--site-header-height) items-center gap-7 max-[821px]:relative max-[821px]:justify-between max-[821px]:gap-3',
        )}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <Brand onNavigate={() => setOpen(false)} />
        <nav
          id="home-navigation"
          className="ml-auto flex items-center gap-[30px] text-sm/5 text-site-muted max-[821px]:absolute max-[821px]:inset-x-[calc((100%-100vw)/2)] max-[821px]:top-(--site-header-height) max-[821px]:z-5 max-[821px]:hidden max-[821px]:border-b max-[821px]:border-site-line max-[821px]:bg-site-bg max-[821px]:px-5 max-[821px]:py-4 max-[821px]:shadow-[0_12px_30px_#0002] max-[821px]:data-[open=true]:grid max-[821px]:data-[open=true]:grid-cols-2 max-[821px]:data-[open=true]:gap-2"
          data-open={open}
          aria-label="Main navigation"
        >
          <Link
            className="py-3 no-underline hover:text-site-text"
            href="/docs/quick-start"
            onClick={() => setOpen(false)}
          >
            Docs
          </Link>
          <Link
            className="py-3 no-underline hover:text-site-text"
            href="/blog"
            onClick={() => setOpen(false)}
          >
            Blog
          </Link>
          <Link
            className="py-3 no-underline hover:text-site-text"
            href="/pricing"
            onClick={() => setOpen(false)}
          >
            Pricing
          </Link>
          <a
            className="inline-flex items-center gap-[7px] py-3 whitespace-nowrap no-underline hover:text-site-text"
            href="https://github.com/edgestorejs/edgestore"
          >
            GitHub
            {githubStars !== undefined && (
              <span
                className="inline-flex items-center gap-[5px] whitespace-nowrap tabular-nums [&_svg]:block [&_svg]:flex-none"
                aria-label={`${githubStars.toLocaleString('en-US')} stars`}
              >
                <Star size={14} aria-hidden="true" />
                {new Intl.NumberFormat('en-US', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                }).format(githubStars)}
              </span>
            )}
          </a>
          <a
            className="py-3 no-underline hover:text-site-text"
            href={dashboardUrl}
          >
            Dashboard
          </a>
        </nav>
        <div className="flex items-center">
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg border-0 bg-transparent text-site-muted hover:bg-site-panel hover:text-site-text"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
            }
          >
            <Sun className="hidden dark:block" size={19} aria-hidden="true" />
            <Moon className="dark:hidden" size={19} aria-hidden="true" />
          </button>
          <button
            ref={toggle}
            type="button"
            className="hidden size-11 place-items-center rounded-lg border-0 bg-transparent text-site-muted hover:bg-site-panel hover:text-site-text max-[821px]:grid"
            aria-expanded={open}
            aria-controls="home-navigation"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={23} /> : <Menu size={23} />}
          </button>
        </div>
      </div>
    </header>
  );
}
