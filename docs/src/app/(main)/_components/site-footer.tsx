import {
  DISCORD_INVITE_URL,
  DOCS_GIT_REF,
  GITHUB_URL,
  SPONSOR_URL,
  X_URL,
  YOUTUBE_URL,
} from '@/lib/constants';
import Link from 'next/link';
import { Brand } from './site-header';

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
    <footer className="ya-footer">
      <div className="ya-container ya-footer-grid">
        <div className="ya-footer-brand">
          <Brand />
          <p>
            Type-safe file uploads
            <br />
            for TypeScript and React.
          </p>
        </div>
        {groups.map((group) => (
          <nav aria-label={group.title} key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href!}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
