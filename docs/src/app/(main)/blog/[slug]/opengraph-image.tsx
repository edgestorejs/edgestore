import { getBlogPost } from '@/lib/source';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

export const alt = 'EdgeStore blog post';
export const contentType = 'image/png';
export const size = {
  width: 1200,
  height: 630,
};

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  return new ImageResponse(
    <div
      style={{
        alignItems: 'stretch',
        background: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'space-between',
        padding: '72px 80px',
        width: '100%',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          fontSize: 30,
          fontWeight: 600,
          gap: 16,
        }}
      >
        <div
          style={{
            background: '#6b6dff',
            borderRadius: 10,
            display: 'flex',
            height: 28,
            width: 28,
          }}
        />
        EdgeStore
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 68,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            maxWidth: 1040,
          }}
        >
          {post.data.title}
        </div>
        <div
          style={{
            color: '#a5b4fc',
            display: 'flex',
            fontSize: 26,
          }}
        >
          edgestore.dev/blog
        </div>
      </div>
    </div>,
    size,
  );
}
