'use client';

import { RootProvider } from 'fumadocs-ui/provider/next';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function DocsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchApi = pathname.startsWith('/v0/docs')
    ? '/api/v0/search'
    : '/api/search';

  return (
    <RootProvider key={searchApi} search={{ options: { api: searchApi } }}>
      {children}
    </RootProvider>
  );
}
