import { createSocialCard } from '@/app/_social-card/card';
import { getBlogPost } from '@/lib/source';

export const runtime = 'nodejs';

const dateFormatter = new Intl.DateTimeFormat('en', {
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return new Response(null, { status: 404 });

  return createSocialCard({
    badge: post.data.category,
    description: post.data.description,
    footerLeft: dateFormatter.format(new Date(post.data.date)),
    footerRight: 'edgestore.dev/blog',
    title: post.data.title,
  });
}
