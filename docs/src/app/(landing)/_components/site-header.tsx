'use client';

import { useAppContext } from '@/components/app-context-provider';
import { Menu, Moon, Star, Sun, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

export function Brand() {
  return (
    <Link href="/" className="ya-brand" aria-label="EdgeStore home">
      <Image
        src="/img/edgestore-lockup-light.svg"
        alt=""
        width={220}
        height={32}
        className="ya-logo-light"
        priority
      />
      <Image
        src="/img/edgestore-lockup.svg"
        alt=""
        width={220}
        height={32}
        className="ya-logo-dark"
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
    <header className="ya-header">
      <a href="#main" className="ya-skip-link">
        Skip to content
      </a>
      <div
        className="ya-container ya-header-inner"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            setOpen(false);
            toggle.current?.focus();
          }
        }}
      >
        <Brand />
        <nav
          id="home-navigation"
          className="ya-nav"
          data-open={open}
          aria-label="Main navigation"
        >
          <Link href="/docs/quick-start" onClick={() => setOpen(false)}>
            Docs
          </Link>
          <Link href="/pricing" onClick={() => setOpen(false)}>
            Pricing
          </Link>
          <a
            className="ya-github-link"
            href="https://github.com/edgestorejs/edgestore"
          >
            GitHub
            {githubStars !== undefined && (
              <span
                className="ya-star-count"
                aria-label={`${githubStars.toLocaleString('en-US')} stars`}
              >
                <Star size={13} aria-hidden="true" />
                {new Intl.NumberFormat('en-US', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                }).format(githubStars)}
              </span>
            )}
          </a>
          <a href={dashboardUrl}>Dashboard</a>
        </nav>
        <div className="ya-header-controls">
          <button
            type="button"
            className="ya-icon-button"
            aria-label="Toggle color theme"
            onClick={() =>
              setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
            }
          >
            <Sun className="ya-logo-dark" size={19} aria-hidden="true" />
            <Moon className="ya-logo-light" size={19} aria-hidden="true" />
          </button>
          <button
            ref={toggle}
            type="button"
            className="ya-icon-button ya-menu-toggle"
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
