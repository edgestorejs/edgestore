import { env } from '@/env';
import { DOCS_ORIGIN } from '@/lib/constants';
import type { Metadata } from 'next';
import Link from 'next/link';
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
import './home.css';
import './_sections/product.css';
import './_sections/community.css';
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
  const signUpUrl = new URL(
    '/sign-up',
    env.NEXT_PUBLIC_DASHBOARD_URL,
  ).toString();

  return (
    <div className="ya-home">
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
            Type-safe file uploads for TypeScript and React. Customizable
            components with hosted storage or your own provider.
          </p>
          <div className="ya-actions">
            <a href={signUpUrl} className="ya-button ya-primary">
              Start for free
            </a>
            <a href="#get-started" className="ya-button ya-secondary">
              Set up with your agent
            </a>
          </div>
          <p className="ya-hero-note">No credit card required.</p>
        </div>
        <UploadShowcase />
      </section>

      <section
        className="ya-agent"
        id="get-started"
        aria-labelledby="agent-title"
      >
        <div className="ya-container">
          <h2 id="agent-title">Add uploads with your agent</h2>
          <p className="ya-section-lead">
            Copy this prompt into your coding agent.
          </p>
          <SetupPrompt />
          <p className="ya-manual-link">
            Or <Link href="/docs/quick-start">follow the quick start</Link>.
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
        className="ya-closing ya-container"
        aria-labelledby="closing-title"
      >
        <div>
          <h2 id="closing-title">Add file uploads to your app</h2>
          <p>Start for free. No credit card required.</p>
        </div>
        <div className="ya-actions">
          <a href={signUpUrl} className="ya-button ya-primary">
            Start for free
          </a>
          <a href="#get-started" className="ya-button ya-secondary">
            Set up with your agent
          </a>
        </div>
      </section>
    </div>
  );
}
