import { loader, type InferPageType } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { blogPosts, docs } from 'fumadocs-mdx:collections/server';
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server';

// See https://fumadocs.dev/docs/headless/source-api for more info
export const source = loader({
  // it assigns a URL to your pages
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
  plugins: [lucideIconsPlugin()],
});

export const blog = loader({
  baseUrl: '/blog',
  source: toFumadocsSource(blogPosts, []),
});

export function getPublishedBlogPosts() {
  return blog.getPages().filter((page) => !page.data.draft);
}

export function getBlogPosts() {
  return process.env.NODE_ENV === 'production'
    ? getPublishedBlogPosts()
    : blog.getPages();
}

export function getBlogPost(slug: string) {
  const page = blog.getPage([slug]);

  if (!page || (process.env.NODE_ENV === 'production' && page.data.draft)) {
    return undefined;
  }

  return page;
}

export type Page = InferPageType<typeof source>;
