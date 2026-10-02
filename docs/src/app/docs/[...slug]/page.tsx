import { GITHUB_URL } from '@/lib/constants';
import { source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { Heading } from 'fumadocs-ui/components/heading';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { HTMLAttributes } from 'react';
import { EditOnGitHub, LLMCopyButton } from './page.client';

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const path = `docs/content/docs/${page.path}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="mb-4 flex flex-row items-center gap-2">
        <LLMCopyButton slug={params.slug} />
        <EditOnGitHub url={`${GITHUB_URL}/blob/dev/${path}`} />
      </div>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
            h2: ({
              children,
              ...props
            }: HTMLAttributes<HTMLHeadingElement>) => (
              <Heading as="h2" {...props}>
                {/* Keep old links working without web-only markup in package references. */}
                {page.url === '/docs/configuration' &&
                  props.id === 'access-control' && (
                    <span
                      id="access-control-experimental"
                      className="scroll-mt-28"
                      aria-hidden="true"
                    />
                  )}
                {children}
              </Heading>
            ),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const socialImage = {
    alt: `${page.data.title} | EdgeStore Docs`,
    height: 630,
    url: `/og/docs/${params.slug?.join('/')}`,
    width: 1200,
  };

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      description: page.data.description,
      images: [socialImage],
      title: page.data.title,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      description: page.data.description,
      images: [socialImage],
      title: page.data.title,
    },
  };
}
