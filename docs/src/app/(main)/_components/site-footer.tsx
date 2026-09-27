import {
  DISCORD_INVITE_URL,
  DOCS_GIT_REF,
  GITHUB_URL,
  SPONSOR_URL,
  X_URL,
  YOUTUBE_URL,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Brand } from './site-header';
import { siteContainer } from './styles';

const groups = [
  {
    title: 'Build',
    links: [
      ['Quick start', '/docs/quick-start'],
      ['Agent setup', '/docs/agents'],
      ['Components', '/docs/components/multi-file'],
      ['Examples', `${GITHUB_URL}/tree/${DOCS_GIT_REF}/examples`],
      ['Pricing', '/pricing'],
    ],
  },
  {
    title: 'Community',
    links: [
      ['GitHub', GITHUB_URL],
      ['Discord', DISCORD_INVITE_URL],
      ['YouTube', YOUTUBE_URL],
      ['X', X_URL],
      ['Sponsor', SPONSOR_URL],
    ],
  },
  {
    title: 'Resources',
    links: [
      ['Blog', '/blog'],
      ['Troubleshooting', '/docs/troubleshooting'],
      ['Releases', `${GITHUB_URL}/releases`],
      ['Terms', '/legal/terms'],
      ['Privacy', '/legal/privacy-policy'],
      ['Disclosure', '/legal/disclosure'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-site-line py-14 max-[601px]:py-10">
      <div
        className={cn(
          siteContainer,
          'grid grid-cols-[1.7fr_1fr_1fr_1fr] gap-10 max-[981px]:grid-cols-3 max-[601px]:gap-x-4 max-[601px]:gap-y-8',
        )}
      >
        <div className="max-[981px]:col-span-full">
          <Brand />
          <p className="my-5 text-sm/7 text-site-muted">
            Type-safe file uploads
            <br />
            for TypeScript and React.
          </p>
        </div>
        {groups.map((group) => (
          <nav aria-label={group.title} key={group.title}>
            <h3 className="mb-4 text-sm font-semibold tracking-[-0.025em]">
              {group.title}
            </h3>
            <ul className="grid gap-3 text-[13px] text-site-muted max-[601px]:text-xs">
              {group.links.map(([label, href]) => (
                <li key={label}>
                  <Link
                    className="no-underline hover:text-site-accent"
                    href={href!}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
