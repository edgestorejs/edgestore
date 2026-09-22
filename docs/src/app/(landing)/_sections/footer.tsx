import {
  DISCORD_INVITE_URL,
  DOCS_GIT_REF,
  GITHUB_URL,
  SPONSOR_URL,
  X_URL,
  YOUTUBE_URL,
} from '@/lib/constants';
import Link from 'next/link';
import { Brand } from '../_components/site-header';

export function Faq() {
  return (
    <section className="ya-faq ya-container" aria-labelledby="faq-title">
      <h2 id="faq-title">Frequently asked questions</h2>
      <div className="ya-faq-list">
        <details>
          <summary>Can I use EdgeStore for free?</summary>
          <p>
            Yes. Hosted storage has a free plan, with no credit card required.
            See <Link href="/pricing">plans and limits</Link>.
          </p>
        </details>
        <details>
          <summary>What file types and sizes are supported?</summary>
          <p>
            Set allowed file types and maximum file sizes per bucket with{' '}
            <code>accept</code> and <code>maxSize</code>. See the{' '}
            <Link href="/docs/configuration#basic-file-validation">
              file validation options
            </Link>
            .
          </p>
        </details>
        <details>
          <summary>Can I use my own storage?</summary>
          <p>
            Yes. Connect{' '}
            <Link href="/docs/providers/s3">S3-compatible storage</Link>,{' '}
            <Link href="/docs/providers/azure-blob">Azure Blob Storage</Link>,
            or a <Link href="/docs/providers/custom">custom provider</Link>.
          </p>
        </details>
        <details>
          <summary>Do I have to use the upload components?</summary>
          <p>
            No. Use the React client with your own UI, or copy and customize our{' '}
            <Link href="/docs/components/multi-file">upload components</Link>.
          </p>
        </details>
        <details>
          <summary>Can I use my existing authentication?</summary>
          <p>
            Yes. Pass your user context to EdgeStore and use it in your{' '}
            <Link href="/docs/configuration#lifecycle-hooks">
              upload and delete
            </Link>{' '}
            rules. Hosted storage also supports{' '}
            <Link href="/docs/configuration#access-control-experimental">
              protected file access
            </Link>
            .
          </p>
        </details>
      </div>
    </section>
  );
}

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
