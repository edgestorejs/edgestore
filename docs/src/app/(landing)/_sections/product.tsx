import { CodeBlock } from '@/app/(main)/(home)/_components/code-block';
import { AstroIcon } from '@/components/icons/frameworks/astro-icon';
import { ExpressIcon } from '@/components/icons/frameworks/express-icon';
import { FastifyIcon } from '@/components/icons/frameworks/fastify-icon';
import { HonoIcon } from '@/components/icons/frameworks/hono-icon';
import { NextIcon } from '@/components/icons/frameworks/next-icon';
import { ReactRouterIcon } from '@/components/icons/frameworks/react-router-icon';
import { TanStackIcon } from '@/components/icons/frameworks/tanstack-icon';
import {
  Blocks,
  BookOpen,
  Cloud,
  CodeXml,
  Database,
  Fingerprint,
  FolderTree,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';

const agentTools = [
  {
    name: 'Skills',
    icon: BookOpen,
    description:
      'Setup guidance and API references for your installed packages.',
    href: '/docs/agents#give-your-agent-the-skill',
  },
  {
    name: 'Plugins',
    icon: Blocks,
    description:
      'Install the skill and MCP together in Codex, Claude Code, or Cursor.',
    href: '/docs/agents#use-a-plugin',
  },
  {
    name: 'MCP',
    icon: Plug,
    description: 'Let your agent work with your EdgeStore projects and files.',
    href: '/docs/agents#mcp-only',
  },
  {
    name: 'CLI',
    icon: Terminal,
    description: 'Set up agent tools and manage storage from your terminal.',
    href: '/docs/agents#set-up-with-the-cli',
  },
];

export function AgentTools() {
  return (
    <div className="ya-agent-tools">
      {agentTools.map(({ name, icon: Icon, description, href }) => (
        <Link href={href} className="ya-agent-tool" key={name}>
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
          <h3>{name}</h3>
          <p>{description}</p>
        </Link>
      ))}
    </div>
  );
}

const serverCode = `import { initEdgeStore } from '@edgestore/server';
import { z } from 'zod';

const es = initEdgeStore.create();

export const router = es.router({
  projectFiles: es.fileBucket({
    maxSize: 10 * 1024 * 1024,
    accept: ['image/*', 'application/pdf'],
  })
    .input(z.object({ projectId: z.string() }))
    .path(({ input }) => [{ project: input.projectId }]),
});

export type EdgeStoreRouter = typeof router;`;

const clientCode = `const { edgestore } = useEdgeStore();

const result = await edgestore.projectFiles.upload({
  file,
  input: { projectId: 'launch' },
  onProgressChange: setProgress,
});

// Inferred from your server router.
result.url;
result.path.project;`;

export function TypedExample() {
  return (
    <section className="ya-section ya-container" aria-labelledby="types-title">
      <div className="ya-section-heading">
        <h2 id="types-title">
          Define it once.
          <br />
          Use it with confidence.
        </h2>
        <div>
          <p>
            Your buckets, inputs, and file paths flow from the server to your
            React client. TypeScript keeps them in sync.
          </p>
          <Link className="ya-text-link" href="/docs/quick-start">
            See the full setup
          </Link>
        </div>
      </div>
      <div className="ya-code-pair">
        <div className="ya-code-pane">
          <div className="ya-code-heading">
            <span>Server router</span>
            <span>server.ts</span>
          </div>
          <CodeBlock code={serverCode} lang="ts" />
        </div>
        <div className="ya-code-pane">
          <div className="ya-code-heading">
            <span>React client</span>
            <span>Upload.tsx</span>
          </div>
          <CodeBlock code={clientCode} lang="ts" />
          <p className="ya-code-note">
            Bucket names, upload input, and returned paths are inferred. No
            duplicate interfaces.
          </p>
        </div>
      </div>
      <p className="ya-footnote">
        Router and upload excerpts. The quick start includes the storage
        provider, framework handler, and React provider.
      </p>
    </section>
  );
}

const features = [
  {
    title: 'Validate before the upload.',
    description:
      'Set file size and type limits per bucket. Validate application input with Zod, Valibot, or another Standard Schema library.',
    icon: ShieldCheck,
    href: '/docs/configuration#basic-file-validation',
    link: 'Configure a bucket',
    detail: ['File types', 'Size limits', 'Validated input'],
  },
  {
    title: 'Keep your access rules in code.',
    description:
      'Use your existing authentication to decide who can upload or delete files. Add protected reads with hosted EdgeStore storage.',
    icon: Fingerprint,
    href: '/docs/configuration#access-control-experimental',
    link: 'Explore access control',
    detail: [
      'Your authentication',
      'Upload and delete hooks',
      'Protected files',
    ],
  },
  {
    title: 'Give users control of their uploads.',
    description:
      'Show progress, cancel a transfer, and control parallel uploads. Start with our React components and make them your own.',
    icon: SlidersHorizontal,
    href: '/docs/components/multi-file',
    link: 'Browse upload components',
    detail: ['Progress', 'Cancellation', 'Concurrency'],
  },
  {
    title: 'Organize files around your app.',
    description:
      'Build file paths and metadata from typed input and user context. Work with files from your backend as well as the browser.',
    icon: FolderTree,
    href: '/docs/backend-client',
    link: 'Use the backend client',
    detail: ['Project folders', 'Typed metadata', 'Backend operations'],
  },
];

export function ProductFeatures() {
  return (
    <section className="ya-feature-section" aria-labelledby="features-title">
      <div className="ya-container ya-feature-layout">
        <div className="ya-feature-intro">
          <h2 id="features-title">
            The details that make
            <br />
            uploads feel finished.
          </h2>
          <p className="ya-section-lead">
            From the first file selection to the rules behind it.
          </p>
          <Link className="ya-text-link" href="/docs/components/dropzone">
            Find a component for your app
          </Link>
        </div>
        <div className="ya-feature-list">
          {features.map(
            ({ title, description, icon: Icon, href, link, detail }) => (
              <article className="ya-feature" key={title}>
                <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <ul className="ya-feature-details">
                    {detail.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link href={href} className="ya-text-link">
                    {link}
                  </Link>
                </div>
              </article>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

export function StorageOptions() {
  return (
    <section
      className="ya-section ya-container"
      aria-labelledby="storage-title"
    >
      <div className="ya-section-heading">
        <h2 id="storage-title">
          Your files.
          <br />
          Your choice of storage.
        </h2>
        <p>
          Use EdgeStore’s hosted storage, connect your own cloud account, or
          build a provider for another service.
        </p>
      </div>
      <div className="ya-storage-grid">
        <article className="ya-hosted">
          <Cloud size={32} strokeWidth={1.5} aria-hidden="true" />
          <h3>Let EdgeStore handle storage.</h3>
          <p>
            File hosting, a management dashboard, protected access, and image
            thumbnails. No storage infrastructure to assemble.
          </p>
          <Link
            className="ya-button ya-primary"
            href="/docs/providers/edgestore"
          >
            Use hosted storage
          </Link>
          <Link className="ya-text-link" href="/pricing">
            View plans and limits
          </Link>
        </article>
        <div className="ya-provider-list">
          <Link href="/docs/providers/s3">
            <Database size={25} aria-hidden="true" />
            <div>
              <h3>S3-compatible storage</h3>
              <p>
                Use AWS S3 or an S3-compatible service with your own bucket.
              </p>
            </div>
          </Link>
          <Link href="/docs/providers/azure-blob">
            <Cloud size={25} aria-hidden="true" />
            <div>
              <h3>Azure Blob Storage</h3>
              <p>Connect a container in your Azure account.</p>
            </div>
          </Link>
          <Link href="/docs/providers/custom">
            <CodeXml size={25} aria-hidden="true" />
            <div>
              <h3>Custom providers</h3>
              <p>
                Connect another storage service with a typed provider interface.
              </p>
            </div>
          </Link>
        </div>
      </div>
      <p className="ya-footnote">
        Provider capabilities differ. Protected reads and image processing may
        need additional infrastructure when you bring your own storage.
      </p>
    </section>
  );
}

const frameworks = [
  { name: 'Next.js', slug: 'next', icon: NextIcon },
  { name: 'TanStack Start', slug: 'tanstack-start', icon: TanStackIcon },
  { name: 'React Router / Remix', slug: 'remix', icon: ReactRouterIcon },
  { name: 'Astro', slug: 'astro', icon: AstroIcon },
  { name: 'Hono', slug: 'hono', icon: HonoIcon },
  { name: 'Express', slug: 'express', icon: ExpressIcon },
  { name: 'Fastify', slug: 'fastify', icon: FastifyIcon },
];

export function Frameworks() {
  return (
    <section
      className="ya-frameworks ya-container"
      aria-labelledby="frameworks-title"
    >
      <h2 id="frameworks-title">Fits the stack you already use.</h2>
      <p className="ya-section-lead">
        Choose your framework to get started. React-only apps can connect to any
        supported backend.
      </p>
      <div className="ya-framework-grid">
        {frameworks.map(({ name, slug, icon: Icon }) => (
          <Link href={`/docs/adapters/${slug}`} key={slug}>
            <Icon className="ya-framework-icon" />
            <span>{name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
