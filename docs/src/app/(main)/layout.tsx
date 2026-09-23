import { env } from '@/env';
import type { ReactNode } from 'react';
import { SiteFooter } from './_components/site-footer';
import { SiteHeader } from './_components/site-header';
import './site.css';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="ya-site">
      <SiteHeader dashboardUrl={env.NEXT_PUBLIC_DASHBOARD_URL} />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
