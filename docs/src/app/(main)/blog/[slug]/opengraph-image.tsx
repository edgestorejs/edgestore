import { createSocialCard } from '@/app/_social-card/card';
import { getBlogPost } from '@/lib/source';
import { notFound } from 'next/navigation';

export const alt = 'EdgeStore blog post';
export const contentType = 'image/png';
export const runtime = 'nodejs';
export const size = {
  width: 1200,
  height: 630,
};

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return createSocialCard({
    badge: post.data.category,
    description: post.data.description,
    footerLeft: dateFormatter.format(new Date(post.data.date)),
    footerRight: 'edgestore.dev/blog',
    title: post.data.title,
  });
}
