import { SITE_URL } from '@/lib/constants';
import { getPublishedBlogPosts, source } from '@/lib/source';
import type { MetadataRoute } from 'next';

const staticRoutes = [
  '/',
  '/blog',
  '/pricing',
  '/legal/disclosure',
  '/legal/privacy-policy',
  '/legal/terms',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticRoutes.map((path) => ({
      url: new URL(path, SITE_URL).toString(),
    })),
    ...source.getPages().map((page) => ({
      url: new URL(page.url, SITE_URL).toString(),
    })),
    ...getPublishedBlogPosts().map((post) => ({
      url: new URL(post.url, SITE_URL).toString(),
      lastModified: post.data.date,
    })),
  ];
}
