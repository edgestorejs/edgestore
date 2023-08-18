'use client';

import Link from 'next/link';
import { usePathname as useNextPathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';

const TABS = [
  { label: 'Single Image', href: '/single-image' },
  { label: 'Multi File', href: '/multi-file' },
  { label: 'Multi File Instant', href: '/multi-file-instant' },
] as const;

export function Tabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-row justify-center">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={twMerge(
            'mx-1 px-2 py-1 text-gray-500 transition-colors duration-200 ease-in-out hover:text-white',
            pathname === tab.href && 'border-b-2 border-white text-white',
          )}
        >
          {tab.label}
        </Link>
      ))}
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
