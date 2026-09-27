import { env } from '@/env';
import type { ReactNode } from 'react';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-site-bg text-site-text antialiased scheme-light [--site-header-height:64px] max-[821px]:[--site-header-height:60px] dark:scheme-dark [&_:focus-visible]:outline-3 [&_:focus-visible]:outline-offset-5 [&_:focus-visible]:outline-site-accent [&_[id]]:scroll-mt-[calc(var(--site-header-height)+24px)]">
      <SiteHeader dashboardUrl={env.NEXT_PUBLIC_DASHBOARD_URL} />
      <main className="min-w-0 flex-1" id="main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
