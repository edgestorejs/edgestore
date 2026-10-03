import { AstroIcon } from '@/components/icons/frameworks/astro-icon';
import { ExpressIcon } from '@/components/icons/frameworks/express-icon';
import { FastifyIcon } from '@/components/icons/frameworks/fastify-icon';
import { HonoIcon } from '@/components/icons/frameworks/hono-icon';
import { NextIcon } from '@/components/icons/frameworks/next-icon';
import { ReactRouterIcon } from '@/components/icons/frameworks/react-router-icon';
import { TanStackIcon } from '@/components/icons/frameworks/tanstack-icon';
import { cn } from '@/lib/utils';
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
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { CodeBlock } from '../_components/code-block';
import {
  siteButton,
  siteContainer,
  sitePrimaryButton,
} from '../../_components/styles';

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
    <div className="mt-10 grid grid-cols-4 max-[981px]:grid-cols-2 max-[981px]:gap-7 max-[601px]:mt-8 max-[601px]:gap-x-5 max-[601px]:gap-y-[26px]">
      {agentTools.map(({ name, icon: Icon, description, href }) => (
        <Link
          href={href}
          className="group border-l border-site-line px-6 first:border-l-0 first:pl-0 last:pr-0 max-[981px]:border-0 max-[981px]:p-0 [&>svg]:mb-3.5 [&>svg]:text-site-accent"
          key={name}
        >
          <Icon size={23} strokeWidth={1.6} aria-hidden="true" />
          <h3 className="text-base font-semibold tracking-[-0.025em] group-hover:text-site-accent">
            {name}
          </h3>
          <p className="mt-2 text-[13px] leading-[1.7] text-site-muted">
            {description}
          </p>
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
    <section
      className={cn(
        siteContainer,
        'py-[100px] max-[981px]:py-[72px] max-[601px]:py-14',
      )}
      aria-labelledby="types-title"
    >
      <div className="mb-[38px] grid max-w-[720px] gap-[18px] max-[601px]:mb-[26px] [&_p]:max-w-[660px] [&_p]:text-[17px]/7 [&_p]:text-site-muted max-[601px]:[&_p]:text-[15px]">
        <h2
          className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
          id="types-title"
        >
          End-to-end type safety
        </h2>
      </div>
      <div className="grid grid-cols-[1.15fr_1fr] overflow-hidden rounded-xl border border-site-line bg-[color-mix(in_srgb,var(--site-panel)_45%,var(--site-bg))] max-[981px]:grid-cols-1">
        <div className="min-w-0 not-first:border-l not-first:border-site-line max-[981px]:not-first:border-t max-[981px]:not-first:border-l-0 [&_figure]:m-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:bg-transparent [&_figure]:shadow-none [&_pre]:min-h-0 [&_pre]:px-5 [&_pre]:py-6 [&_pre]:text-xs max-[601px]:[&_pre]:text-[11px]">
          <div className="flex justify-between gap-3 border-b border-site-line px-5 py-4 text-[13px]">
            <span>Server router</span>
            <span className="text-site-muted">server.ts</span>
          </div>
          <CodeBlock code={serverCode} lang="ts" />
        </div>
        <div className="min-w-0 not-first:border-l not-first:border-site-line max-[981px]:not-first:border-t max-[981px]:not-first:border-l-0 [&_figure]:m-0 [&_figure]:rounded-none [&_figure]:border-0 [&_figure]:bg-transparent [&_figure]:shadow-none [&_pre]:min-h-0 [&_pre]:px-5 [&_pre]:py-6 [&_pre]:text-xs max-[601px]:[&_pre]:text-[11px]">
          <div className="flex justify-between gap-3 border-b border-site-line px-5 py-4 text-[13px]">
            <span>React client</span>
            <span className="text-site-muted">Upload.tsx</span>
          </div>
          <CodeBlock code={clientCode} lang="ts" />
          <p className="border-t border-site-line p-[22px] text-[13px] leading-[1.65] text-site-muted">
            Bucket names, upload input, and returned paths are inferred. No
            duplicate interfaces.
          </p>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    title: 'Temporary files',
    description:
      'With hosted storage, unconfirmed uploads are deleted after 24 hours. Confirm files when the user saves.',
    icon: Timer,
    href: '/docs/quick-start#temporary-files',
    link: 'Use temporary uploads',
    detail: ['Automatic cleanup', 'Confirm on save'],
  },
  {
    title: 'File validation',
    description:
      'Set file size and type limits per bucket. Validate application input with Zod, Valibot, or another Standard Schema library.',
    icon: ShieldCheck,
    href: '/docs/configuration#basic-file-validation',
    link: 'Configure a bucket',
    detail: ['File types', 'Size limits', 'Validated input'],
  },
  {
    title: 'Access control',
    description:
      'Use your existing authentication to decide who can upload or delete files. Add protected reads with hosted EdgeStore storage.',
    icon: Fingerprint,
    href: '/docs/configuration#access-control',
    link: 'Explore access control',
    detail: [
      'Your authentication',
      'Upload and delete hooks',
      'Protected files',
    ],
  },
  {
    title: 'Upload controls',
    description:
      'Show progress, cancel a transfer, and control parallel uploads. Customize our React components or use your own UI.',
    icon: SlidersHorizontal,
    href: '/docs/components/multi-file',
    link: 'Browse upload components',
    detail: ['Progress', 'Cancellation', 'Concurrency'],
  },
  {
    title: 'File paths and metadata',
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
    <section
      className="border-y border-site-line bg-[color-mix(in_srgb,var(--site-panel)_25%,var(--site-bg))] py-[84px] max-[601px]:py-[50px]"
      aria-labelledby="features-title"
    >
      <div
        className={cn(
          siteContainer,
          'grid grid-cols-[1fr_1.15fr] items-start gap-[72px] max-[981px]:grid-cols-1 max-[981px]:gap-[38px]',
        )}
      >
        <div className="sticky top-[calc(var(--site-header-height)+24px)] max-[981px]:static">
          <h2
            className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
            id="features-title"
          >
            Validation, permissions, and upload controls
          </h2>
          <Link
            className="mt-[18px] inline-block text-sm font-medium text-site-accent underline decoration-transparent underline-offset-5 hover:decoration-current"
            href="/docs/components/dropzone"
          >
            Browse upload components
          </Link>
        </div>
        <div className="grid">
          {features.map(
            ({ title, description, icon: Icon, href, link, detail }) => (
              <article
                className="flex gap-[22px] border-t border-site-line py-[30px] first:border-t-0 first:pt-0 last:pb-0 max-[601px]:gap-4 [&>svg]:mt-[3px] [&>svg]:text-site-accent"
                key={title}
              >
                <Icon size={25} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <h3 className="text-[21px] leading-[1.3] font-semibold tracking-[-0.025em] max-[601px]:text-[19px]">
                    {title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.75] text-site-muted max-[601px]:text-sm">
                    {description}
                  </p>
                  <ul className="mt-3.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-xs text-site-muted max-[601px]:gap-x-3 max-[601px]:gap-y-[5px]">
                    {detail.map((item) => (
                      <li
                        className="before:mr-[7px] before:text-site-accent before:content-['✓']"
                        key={item}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={href}
                    className="mt-[18px] inline-block text-sm font-medium text-site-accent underline decoration-transparent underline-offset-5 hover:decoration-current"
                  >
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
      className={cn(
        siteContainer,
        'py-[100px] max-[981px]:py-[72px] max-[601px]:py-14',
      )}
      aria-labelledby="storage-title"
    >
      <div className="mb-[38px] grid max-w-[720px] gap-[18px] max-[601px]:mb-[26px]">
        <h2
          className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
          id="storage-title"
        >
          Hosted or bring your own storage
        </h2>
        <p className="max-w-[660px] text-[17px]/7 text-site-muted max-[601px]:text-[15px]">
          Use EdgeStore’s hosted storage, connect your own cloud account, or
          build a provider for another service.
        </p>
      </div>
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-site-line max-[601px]:grid-cols-1">
        <article className="flex flex-col items-start bg-[color-mix(in_srgb,var(--site-accent)_7%,var(--site-bg))] p-9 max-[601px]:p-[26px] [&>svg]:mb-[25px] [&>svg]:text-site-accent">
          <Cloud size={32} strokeWidth={1.5} aria-hidden="true" />
          <h3 className="text-2xl font-semibold tracking-[-0.025em] max-[601px]:text-[22px]">
            EdgeStore hosted storage
          </h3>
          <p className="mt-3.5 max-w-[440px] text-[15px] leading-[1.8] text-site-muted">
            File hosting, a management dashboard, protected access, and image
            thumbnails.
          </p>
          <Link
            className={cn(siteButton, sitePrimaryButton, 'mt-[30px]')}
            href="/docs/providers/edgestore"
          >
            Use hosted storage
          </Link>
          <Link
            className="mt-[18px] inline-block text-sm font-medium text-site-accent underline decoration-transparent underline-offset-5 hover:decoration-current"
            href="/pricing"
          >
            View plans and limits
          </Link>
        </article>
        <div className="border-l border-site-line max-[601px]:border-t max-[601px]:border-l-0 [&_svg]:text-site-accent">
          <Link
            className="flex gap-5 border-b border-site-line p-[30px] last:border-b-0 hover:bg-site-panel max-[601px]:p-6"
            href="/docs/providers/s3"
          >
            <Database size={25} aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.025em]">
                S3-compatible storage
              </h3>
              <p className="mt-[7px] text-sm leading-[1.7] text-site-muted">
                Use AWS S3 or an S3-compatible service with your own bucket.
              </p>
            </div>
          </Link>
          <Link
            className="flex gap-5 border-b border-site-line p-[30px] last:border-b-0 hover:bg-site-panel max-[601px]:p-6"
            href="/docs/providers/azure-blob"
          >
            <Cloud size={25} aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.025em]">
                Azure Blob Storage
              </h3>
              <p className="mt-[7px] text-sm leading-[1.7] text-site-muted">
                Connect a container in your Azure account.
              </p>
            </div>
          </Link>
          <Link
            className="flex gap-5 border-b border-site-line p-[30px] last:border-b-0 hover:bg-site-panel max-[601px]:p-6"
            href="/docs/providers/custom"
          >
            <CodeXml size={25} aria-hidden="true" />
            <div>
              <h3 className="text-lg font-semibold tracking-[-0.025em]">
                Custom providers
              </h3>
              <p className="mt-[7px] text-sm leading-[1.7] text-site-muted">
                Connect another storage service with a typed provider interface.
              </p>
            </div>
          </Link>
        </div>
      </div>
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
      className={cn(
        siteContainer,
        'border-t border-site-line pt-[65px] pb-[90px] max-[601px]:py-11',
      )}
      aria-labelledby="frameworks-title"
    >
      <h2
        className="text-[clamp(28px,3.3vw,44px)] leading-[1.16] font-[650] tracking-[-0.045em] text-balance"
        id="frameworks-title"
      >
        Supported frameworks
      </h2>
      <p className="mt-[15px] max-w-[650px] text-[17px] leading-[1.65] text-site-muted max-[601px]:text-[15px]">
        Choose your framework to get started. React-only apps can connect to any
        supported backend.
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-x-(--framework-gap) gap-y-5 [--framework-columns:7] [--framework-gap:12px] max-[981px]:[--framework-columns:4] max-[981px]:[--framework-gap:24px] max-[601px]:mt-[25px] max-[601px]:[--framework-columns:3] max-[601px]:[--framework-gap:12px]">
        {frameworks.map(({ name, slug, icon: Icon }) => (
          <Link
            className="flex shrink-0 grow-0 basis-[calc((100%-(var(--framework-columns)-1)*var(--framework-gap))/var(--framework-columns))] flex-col items-center gap-3 rounded-lg px-1 py-4 text-center text-[13px] leading-[1.5] hover:bg-site-panel hover:text-site-accent max-[601px]:text-xs"
            href={`/docs/adapters/${slug}`}
            key={slug}
          >
            <span
              className="grid size-11 place-items-center"
              aria-hidden="true"
            >
              <Icon className="size-8" />
            </span>
            <span className="min-h-[3em] text-balance">{name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
