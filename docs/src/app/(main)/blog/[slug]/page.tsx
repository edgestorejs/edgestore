import { getBlogPost, getBlogPosts } from '@/lib/source';
import { getMDXComponents } from '@/mdx-components';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const page = getBlogPost(slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <main className="container w-full max-w-4xl flex-1 py-12 sm:py-20">
      <Link
        href="/blog"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" />
        Back to blog
      </Link>

      <article className="mt-12">
        <header className="border-b pb-10 sm:pb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {page.data.title}
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground sm:text-xl">
            {page.data.description}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {page.data.draft ? (
              <>
                <span className="font-medium text-primary">Draft</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            <span>{page.data.author}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={page.data.date}>
              {dateFormatter.format(new Date(page.data.date))}
            </time>
          </div>
        </header>

        <div className="prose mt-10 max-w-none sm:mt-12">
          <InlineTOC items={page.data.toc} />
          <MDXContent components={getMDXComponents()} />
        </div>
      </article>
    </main>
  );
}

export function generateStaticParams(): { slug: string }[] {
  return getBlogPosts().map((page) => ({
    slug: page.slugs[0]!,
  }));
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getBlogPost(slug);
  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
    },
    authors: [{ name: page.data.author }],
    openGraph: {
      type: 'article',
      title: page.data.title,
      description: page.data.description,
      publishedTime: page.data.date,
      authors: [page.data.author],
      url: page.url,
    },
  };
}

export const dynamicParams = false;
