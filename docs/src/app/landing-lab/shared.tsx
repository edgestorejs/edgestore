import { ArrowUpRight, Check, Github } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { CopyPrompt } from './copy-prompt';

export function Navigation() {
  return (
    <header className="ll-nav ll-width">
      <Link href="/" aria-label="EdgeStore home">
        <Image
          className="ll-logo-light"
          src="/img/edgestore-lockup-light.svg"
          alt="EdgeStore"
          width={188}
          height={28}
          priority
        />
        <Image
          className="ll-logo-dark"
          src="/img/edgestore-lockup.svg"
          alt="EdgeStore"
          width={188}
          height={28}
          priority
        />
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/docs/quick-start">Docs</Link>
        <Link href="/pricing">Pricing</Link>
        <a
          href="https://github.com/edgestorejs/edgestore"
          aria-label="EdgeStore on GitHub"
          className="ll-github"
        >
          <Github size={19} />
        </a>
        <a href="https://dashboard.edgestore.dev" className="ll-dashboard">
          Dashboard <ArrowUpRight size={15} />
        </a>
      </nav>
    </header>
  );
}

export function StartWithAgent() {
  return (
    <section id="get-started" className="ll-start ll-width">
      <div>
        <h2>
          Add uploads.
          <br />
          Start with a prompt.
        </h2>
        <p>Your agent handles the integration. You decide what to build.</p>
      </div>
      <Prompt />
    </section>
  );
}

export function HeroLinks() {
  return (
    <div className="ll-hero-links">
      <a href="#get-started">
        Get started <ArrowUpRight size={17} />
      </a>
      <Link href="/docs/components/multi-file">Explore components</Link>
    </div>
  );
}

export function Prompt() {
  return (
    <div className="ll-prompt">
      <CopyPrompt />
      <p className="ll-prompt-help">
        Paste into your coding agent to get started.
      </p>
      <Link className="ll-text-link" href="/docs/quick-start">
        Prefer to set it up yourself? <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}

const frameworks = [
  ['Next.js', 'next'],
  ['TanStack Start', 'tanstack-start'],
  ['React Router', 'remix'],
  ['Astro', 'astro'],
  ['Hono', 'hono'],
  ['Express', 'express'],
  ['Fastify', 'fastify'],
];

export function Frameworks() {
  return (
    <section className="ll-frameworks ll-width" aria-label="Framework guides">
      <p>At home in your stack.</p>
      <div>
        {frameworks.map(([label, path]) => (
          <Link key={path} href={`/docs/adapters/${path}`}>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function StorageChoices() {
  return (
    <section className="ll-storage ll-width">
      <div>
        <h2>
          Your files.
          <br />
          Your choice of storage.
        </h2>
        <p>
          Start with EdgeStore&apos;s hosted storage, bring your own bucket, or
          connect another service with a custom provider.
        </p>
      </div>
      <div className="ll-provider-list">
        {[
          ['EdgeStore', 'Hosted storage, ready to use', 'edgestore'],
          ['S3-compatible', 'Your existing S3-compatible bucket', 's3'],
          ['Azure Blob', 'Your Azure storage account', 'azure-blob'],
          ['Custom provider', 'Connect another storage service', 'custom'],
        ].map(([name, text, slug]) => (
          <Link key={slug} href={`/docs/providers/${slug}`}>
            <div>
              <h3>{name}</h3>
              <p>{text}</p>
            </div>
            <ArrowUpRight size={20} />
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FeatureRows() {
  return (
    <div className="ll-feature-rows">
      {[
        [
          'Rules on your server.',
          'Set file types and size limits. Use your existing authentication to decide who can upload and delete.',
        ],
        [
          'Types in your editor.',
          'Your React client infers bucket names and input types from your server router.',
        ],
        [
          'An interface that is yours.',
          'Use customizable React dropzones and previews, or build your own with progress and cancellation.',
        ],
      ].map(([title, description]) => (
        <div key={title}>
          <Check size={19} />
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Closing({
  title = 'Your next feature starts here.',
}: {
  title?: string;
}) {
  return (
    <section className="ll-closing ll-width">
      <h2>{title}</h2>
      <Prompt />
      <Link href="/docs/agents" className="ll-text-link">
        Explore skills, plugins and MCP <ArrowUpRight size={16} />
      </Link>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="ll-footer ll-width">
      <span>EdgeStore. Built for your next upload.</span>
      <nav aria-label="Footer">
        <a href="https://github.com/edgestorejs/edgestore">GitHub</a>
        <a href="https://discord.gg/HvrnhRTfgQ">Discord</a>
        <Link href="/docs/quick-start">Documentation</Link>
      </nav>
    </footer>
  );
}
