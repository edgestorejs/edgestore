import { blog } from '@/lib/source';
import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'News, release notes, and technical articles from EdgeStore.',
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  dateStyle: 'long',
  timeZone: 'UTC',
});

export default function BlogPage() {
  const posts = blog
    .getPages()
    .toSorted((a, b) => b.data.date.localeCompare(a.data.date));

  return (
    <main className="container w-full max-w-5xl flex-1 py-16 sm:py-24">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Blog
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Release notes and technical updates from EdgeStore.
        </p>
      </header>

      {posts.length > 0 ? (
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.url}
              href={post.url}
              className="group flex min-h-64 flex-col rounded-2xl border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-accent/40 sm:p-8"
            >
              <time
                dateTime={post.data.date}
                className="text-sm text-muted-foreground"
              >
                {dateFormatter.format(new Date(post.data.date))}
              </time>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-balance">
                {post.data.title}
              </h2>
              <p className="mt-3 leading-7 text-muted-foreground">
                {post.data.description}
              </p>
              <span className="mt-auto inline-flex items-center gap-2 pt-8 text-sm font-medium text-primary">
                Read article
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <section className="mt-16 rounded-2xl border border-dashed p-8 sm:mt-20 sm:p-12">
          <h2 className="text-xl font-semibold">
            The first post is on its way.
          </h2>
          <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
            We’ll start with a look at the next major EdgeStore release. In the
            meantime, the documentation has everything you need to get started.
          </p>
          <Link
            href="/docs/quick-start"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            Read the quick start
            <ArrowRightIcon className="size-4" />
          </Link>
        </section>
      )}
    </main>
  );
}
