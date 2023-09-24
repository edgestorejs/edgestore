'use client';

import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname as useNextPathname } from 'next/navigation';

const TABS = [
  { label: 'single image', href: '/single-image' },
  { label: 'multi file', href: '/multi-file' },
  { label: 'multi file instant', href: '/multi-file-instant' },
] as const;

export function Tabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-row justify-center">
      <TabsList>
        {TABS.map((tab) => (
          <TabsTrigger key={tab.href} active={pathname === tab.href}>
            <Link href={tab.href}>{tab.label}</Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}

/**
 * Retrieves the current url pathname, **from the base path**.
 * Note: This is used as a workaround because the current implementation of `usePathname` from NextJS is inconsistent
 * in scenarios where the application is running with a "basePath" that is not the root. In this scenario, on the
 * server side `usePathname` would return the path after the base path but on the client side, it would result in the
 * path including the base path. This in turn could cause the application to rehydrate improperly and trigger errors
 * when the page hydrates in the browser. See: https://github.com/vercel/next.js/issues/46562
 */
export function usePathname() {
  let pathname = useNextPathname();
  if (
    pathname &&
    process.env.NEXT_PUBLIC_BASE_PATH &&
    pathname.startsWith(process.env.NEXT_PUBLIC_BASE_PATH)
  ) {
    pathname = pathname.substring(process.env.NEXT_PUBLIC_BASE_PATH.length);
    return pathname === '' ? '/' : pathname;
  }
  return pathname;
}
