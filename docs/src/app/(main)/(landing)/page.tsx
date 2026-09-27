import { env } from '@/env';
import { DOCS_ORIGIN } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  siteButton,
  siteContainer,
  sitePrimaryButton,
  siteSecondaryButton,
} from '../_components/styles';
import { SetupPrompt } from './_components/setup-prompt';
import { UploadShowcase } from './_components/upload-showcase';
import { DeveloperQuotes, UploadComponents } from './_sections/community';
import { Faq } from './_sections/faq';
import {
  AgentTools,
  Frameworks,
  ProductFeatures,
  StorageOptions,
  TypedExample,
} from './_sections/product';

const description =
  'Type-safe file uploads for TypeScript and React. Customizable components, your choice of storage, and tools for your coding agent.';

export const metadata: Metadata = {
  metadataBase: new URL(DOCS_ORIGIN),
  title: {
    absolute: 'EdgeStore | Type-safe file uploads for TypeScript and React',
  },
  description,
  alternates: { canonical: DOCS_ORIGIN },
  openGraph: {
    title: 'EdgeStore | Your app. Your uploads. Your rules.',
    description,
    url: DOCS_ORIGIN,
    type: 'website',
    images: ['/opengraph-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EdgeStore | Your app. Your uploads. Your rules.',
    description,
    images: ['/opengraph-image.png'],
  },
};

export default function HomePage() {
  const signUpUrl = new URL(
    '/sign-up',
    env.NEXT_PUBLIC_DASHBOARD_URL,
  ).toString();

  return (
    <div className="[&_svg]:shrink-0">
      <section
        className={cn(
          siteContainer,
          'grid min-h-[690px] grid-cols-[0.94fr_1.06fr] items-center gap-[26px] pt-14 pb-[68px] max-[981px]:grid-cols-1 max-[981px]:gap-8 max-[981px]:pt-[54px] max-[981px]:pb-[65px] max-[601px]:py-9',
        )}
        aria-labelledby="hero-title"
      >
        <div className="pt-5 pb-10 max-[981px]:p-0">
          <h1
            className="text-[clamp(58px,6.15vw,88px)] leading-[1.065] font-[750] tracking-[-0.058em] max-[1191px]:text-[62px] max-[981px]:text-[clamp(58px,9vw,80px)] max-[601px]:text-[clamp(42px,12.9vw,70px)] max-[601px]:leading-[1.08] max-[601px]:tracking-[-0.055em]"
            id="hero-title"
          >
            Your app.
            <br />
            Your uploads.
            <br />
            Your rules.
          </h1>
          <p className="mt-[30px] max-w-[500px] text-[clamp(18px,1.55vw,21px)] leading-[1.6] tracking-[-0.025em] text-site-muted max-[981px]:max-w-[580px] max-[601px]:mt-6 max-[601px]:text-[17px]">
            Type-safe file uploads for TypeScript and React. Customizable
            components with hosted storage or your own provider.
          </p>
          <div className="mt-8 flex flex-wrap gap-3.5 max-[1191px]:gap-2.5 max-[601px]:mt-[26px]">
            <a
              href={signUpUrl}
              className={cn(
                siteButton,
                sitePrimaryButton,
                'max-[1191px]:px-[17px] max-[1191px]:text-sm max-[601px]:px-4 max-[601px]:text-[13px]',
              )}
            >
              Start for free
            </a>
            <a
              href="#get-started"
              className={cn(
                siteButton,
                siteSecondaryButton,
                'max-[1191px]:px-[17px] max-[1191px]:text-sm max-[601px]:px-4 max-[601px]:text-[13px]',
              )}
            >
              Set up with your agent
            </a>
          </div>
          <p className="mt-[17px] text-[13px] text-site-muted">
            No credit card required.
          </p>
        </div>
        <UploadShowcase />
      </section>

      <section
        className="border-y border-site-line bg-[color-mix(in_srgb,var(--site-panel)_30%,var(--site-bg))] pt-[54px] pb-12 max-[601px]:py-[38px]"
        id="get-started"
        aria-labelledby="agent-title"
      >
        <div className={siteContainer}>
          <h2
            className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
            id="agent-title"
          >
            Add uploads with your agent
          </h2>
          <p className="mt-[15px] max-w-[650px] text-[17px] leading-[1.65] text-site-muted max-[601px]:text-[15px]">
            Copy this prompt into your coding agent.
          </p>
          <SetupPrompt />
          <p className="mt-4 text-[13px] text-site-muted">
            Or{' '}
            <Link
              className="text-site-accent underline underline-offset-4"
              href="/docs/quick-start"
            >
              follow the quick start
            </Link>
            .
          </p>
          <AgentTools />
        </div>
      </section>

      <TypedExample />
      <ProductFeatures />
      <UploadComponents />
      <StorageOptions />
      <Frameworks />
      <DeveloperQuotes />
      <Faq />

      <section
        className={cn(
          siteContainer,
          'flex items-center justify-between gap-10 border-t border-site-line py-[74px] max-[1191px]:flex-col max-[1191px]:items-start max-[1191px]:gap-[26px] max-[601px]:py-12',
        )}
        aria-labelledby="closing-title"
      >
        <div>
          <h2
            className="text-[clamp(28px,2.7vw,36px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
            id="closing-title"
          >
            Add file uploads to your app
          </h2>
          <p className="mt-3 text-[15px] text-site-muted">
            Start for free. No credit card required.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3.5">
          <a
            href={signUpUrl}
            className={cn(
              siteButton,
              sitePrimaryButton,
              'max-[601px]:px-[18px] max-[601px]:text-[13px]',
            )}
          >
            Start for free
          </a>
          <a
            href="#get-started"
            className={cn(
              siteButton,
              siteSecondaryButton,
              'max-[601px]:px-[18px] max-[601px]:text-[13px]',
            )}
          >
            Set up with your agent
          </a>
        </div>
      </section>
    </div>
  );
}
