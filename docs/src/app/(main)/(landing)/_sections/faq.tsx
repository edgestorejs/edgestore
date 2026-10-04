import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { siteContainer } from '../../_components/styles';

export function Faq() {
  return (
    <section
      className={cn(
        siteContainer,
        'grid grid-cols-[1fr_1.15fr] items-start gap-[72px] border-t border-site-line py-[70px] max-[981px]:grid-cols-1 max-[981px]:gap-[38px] max-[601px]:gap-[30px] max-[601px]:py-11',
      )}
      aria-labelledby="faq-title"
    >
      <h2
        className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
        id="faq-title"
      >
        Frequently asked questions
      </h2>
      <div className="rounded-xl border border-site-line bg-[color-mix(in_srgb,var(--site-panel)_25%,var(--site-bg))]">
        <FaqItem question="Can I use EdgeStore for free?">
          Yes. Hosted storage has a free plan, with no credit card required. See{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/pricing"
          >
            plans and limits
          </Link>
          .
        </FaqItem>
        <FaqItem question="What file types and sizes are supported?">
          Set allowed file types and maximum file sizes per bucket with{' '}
          <code>accept</code> and <code>maxSize</code>. See the{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/configuration#basic-file-validation"
          >
            file validation options
          </Link>
          .
        </FaqItem>
        <FaqItem question="Can I use my own storage?">
          Yes. Connect{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/providers/s3"
          >
            S3-compatible storage
          </Link>
          ,{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/providers/azure-blob"
          >
            Azure Blob Storage
          </Link>
          , or a{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/providers/custom"
          >
            custom provider
          </Link>
          .
        </FaqItem>
        <FaqItem question="Do I have to use the upload components?">
          No. Use the React client with your own UI, or copy and customize our{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/components/multi-file"
          >
            upload components
          </Link>
          .
        </FaqItem>
        <FaqItem question="Can I use my existing authentication?">
          Yes. Pass your user context to EdgeStore and use it in your{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/configuration#lifecycle-hooks"
          >
            upload and delete
          </Link>{' '}
          rules. Hosted storage also supports{' '}
          <Link
            className="text-site-accent underline underline-offset-[3px]"
            href="/docs/configuration#access-control"
          >
            protected file access
          </Link>
          .
        </FaqItem>
      </div>
    </section>
  );
}

function FaqItem({
  question,
  children,
}: {
  question: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-b border-site-line last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg px-6 py-[22px] text-base leading-[1.6] font-[550] group-open:pb-3 hover:bg-site-accent/5 max-[601px]:gap-[18px] max-[601px]:p-[18px] max-[601px]:text-[15px] [&::-webkit-details-marker]:hidden">
        {question}
        <Plus
          size={20}
          className="shrink-0 text-site-accent [&>path:last-child]:group-open:hidden"
          aria-hidden="true"
        />
      </summary>
      <p className="max-w-[600px] px-6 pb-6 text-sm leading-[1.8] text-site-muted max-[601px]:px-[18px] max-[601px]:pb-[18px]">
        {children}
      </p>
    </details>
  );
}
