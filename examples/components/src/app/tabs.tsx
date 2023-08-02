'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
            'mx-1 px-2 py-1 text-gray-500 transition-all duration-200 ease-in-out hover:text-white',
            pathname === tab.href && 'border-b-2 border-white text-white',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
