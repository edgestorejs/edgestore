import { loader, type InferPageType } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { blogPosts, docs } from 'fumadocs-mdx:collections/server';
import { toFumadocsSource } from 'fumadocs-mdx/runtime/server';
import { getBlogDeployment } from './blogDeployment';

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

export const blogDeployment = getBlogDeployment({
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV,
  previewUrl: process.env.VERCEL_URL,
});

export function getPublishedBlogPosts() {
  return blog.getPages().filter((page) => !page.data.draft);
}

export function getBlogPosts() {
  return blogDeployment.showDrafts ? blog.getPages() : getPublishedBlogPosts();
}

export function getBlogPost(slug: string[]) {
  const page = blog.getPage(slug);

  if (!page || (!blogDeployment.showDrafts && page.data.draft)) {
    return undefined;
  }

  return page;
}

export type Page = InferPageType<typeof source>;
