import { EditOnGitHub, LLMCopyButton } from '@/app/docs/[...slug]/page.client';
import { DocsVersionNotice } from '@/components/docs-version-notice';
import { DOCS_GIT_REF, GITHUB_URL } from '@/lib/constants';
import { v0Source as source } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from 'fumadocs-ui/page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;
  const path = `docs/content/v0/${page.path}`;

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsVersionNotice legacy />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="mb-4 flex flex-row items-center gap-2">
        <LLMCopyButton slug={params.slug} baseUrl="/v0/docs" />
        <EditOnGitHub url={`${GITHUB_URL}/blob/${DOCS_GIT_REF}/${path}`} />
      </div>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // this allows you to link to other pages with relative file paths
            a: createRelativeLink(source, page),
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
    url: `/og/v0/docs/${params.slug?.join('/')}`,
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
