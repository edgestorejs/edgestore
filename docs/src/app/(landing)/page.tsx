import { env } from '@/env';
import { DOCS_ORIGIN } from '@/lib/constants';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SetupPrompt } from './_components/setup-prompt';
import { SiteHeader } from './_components/site-header';
import { UploadShowcase } from './_components/upload-showcase';
import { Faq, SiteFooter } from './_sections/footer';
import {
  AgentTools,
  Frameworks,
  ProductFeatures,
  StorageOptions,
  TypedExample,
} from './_sections/product';
import './home.css';
import './_sections/product.css';
import './_components/upload-showcase.css';
import './responsive.css';

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
  return (
    <div className="ya-site">
      <SiteHeader dashboardUrl={env.NEXT_PUBLIC_DASHBOARD_URL} />
      <main id="main">
        <section className="ya-hero ya-container" aria-labelledby="hero-title">
          <div className="ya-hero-copy">
            <h1 id="hero-title">
              Your app.
              <br />
              Your uploads.
              <br />
              Your rules.
            </h1>
            <p className="ya-lead">
              Type-safe file uploads for TypeScript and React. Built for your
              stack, your storage, and your coding agent.
            </p>
            <div className="ya-actions">
              <a href="#get-started" className="ya-button ya-primary">
                Build with your agent
              </a>
              <Link href="/docs/quick-start" className="ya-button ya-secondary">
                Read the docs
              </Link>
            </div>
            <p className="ya-hero-note">
              Use our components or bring your own UI.
            </p>
          </div>
          <UploadShowcase />
        </section>

        <section
          className="ya-agent"
          id="get-started"
          aria-labelledby="agent-title"
        >
          <div className="ya-container">
            <h2 id="agent-title">One prompt to make it yours.</h2>
            <p className="ya-section-lead">
              Copy it into your coding agent to add uploads that fit your app.
            </p>
            <SetupPrompt />
            <p className="ya-manual-link">
              Prefer to write the code?{' '}
              <Link href="/docs/quick-start">Follow the quick start</Link>.
            </p>
            <AgentTools />
          </div>
        </section>

        <TypedExample />
        <ProductFeatures />
        <StorageOptions />
        <Frameworks />
        <Faq />

        <section
          className="ya-closing ya-container"
          aria-labelledby="closing-title"
        >
          <div>
            <h2 id="closing-title">Make uploads part of your app.</h2>
            <p>Start with a prompt. Keep control of the code.</p>
          </div>
          <div className="ya-actions">
            <a href="#get-started" className="ya-button ya-primary">
              Get the setup prompt
            </a>
            <a
              href={env.NEXT_PUBLIC_DASHBOARD_URL}
              className="ya-button ya-secondary"
            >
              Open dashboard
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
