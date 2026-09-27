import { createSocialCard } from '@/app/_social-card/card';
import { v0Source as source } from '@/lib/source';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return new Response(null, { status: 404 });

  return createSocialCard({
    badge: 'v0 documentation',
    description: page.data.description,
    footerLeft: 'EdgeStore Docs',
    footerRight: `edgestore.dev${page.url}`,
    title: page.data.title,
  });
}
