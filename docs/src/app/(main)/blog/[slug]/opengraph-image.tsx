import { readFile } from 'node:fs/promises';
import { getBlogPost } from '@/lib/source';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';

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

const assetsPromise = Promise.all([
  readFile(new URL('./assets/nunito-bold.ttf', import.meta.url)),
  readFile(new URL('./assets/geist-regular.ttf', import.meta.url)),
  readFile(new URL('../../../../../public/img/logo-sm.png', import.meta.url)),
  readFile(new URL('../../../../../public/img/edgestore.svg', import.meta.url)),
]);

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function toDataUrl(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

function getTitleFontSize(title: string): number {
  if (title.length > 115) return 46;
  if (title.length > 85) return 54;
  return 62;
}

function getDescriptionFontSize(description: string): number {
  return description.length > 150 ? 21 : 25;
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const [nunito, geist, logo, wordmark] = await assetsPromise;
  const titleFontSize = getTitleFontSize(post.data.title);
  const descriptionFontSize = getDescriptionFontSize(post.data.description);

  return new ImageResponse(
    <div
      style={{
        background: '#101217',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Geist',
        height: '100%',
        justifyContent: 'space-between',
        overflow: 'hidden',
        padding: '60px 72px 50px',
        position: 'relative',
        width: '100%',
      }}
    >
      <div
        style={{
          border: '1px solid rgba(148, 163, 184, 0.12)',
          display: 'flex',
          height: 315,
          position: 'absolute',
          right: -80,
          top: 158,
          transform: 'rotate(12deg)',
          width: 315,
        }}
      />

      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 17,
          }}
        >
          <img
            alt=""
            height={54}
            src={toDataUrl(logo, 'image/png')}
            width={54}
          />
          <img
            alt="EdgeStore"
            height={31}
            src={toDataUrl(wordmark, 'image/svg+xml')}
            width={262}
          />
        </div>

        {post.data.category ? (
          <div
            style={{
              alignItems: 'center',
              background: 'rgba(139, 92, 246, 0.14)',
              border: '1px solid #675a91',
              borderRadius: 999,
              color: '#c4b5fd',
              display: 'flex',
              fontSize: 18,
              letterSpacing: '0.055em',
              padding: '10px 17px',
              textTransform: 'uppercase',
            }}
          >
            {post.data.category}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          maxWidth: 1035,
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontFamily: 'Nunito',
            fontSize: titleFontSize,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.02,
          }}
        >
          {post.data.title}
        </div>
        <div
          style={{
            color: '#aeb6c5',
            display: 'flex',
            fontSize: descriptionFontSize,
            lineHeight: 1.35,
            maxWidth: 920,
          }}
        >
          {post.data.description}
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid #343842',
          color: '#9299a7',
          display: 'flex',
          fontSize: 20,
          justifyContent: 'space-between',
          paddingTop: 24,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex' }}>
          {dateFormatter.format(new Date(post.data.date))}
        </div>
        <div style={{ display: 'flex' }}>edgestore.dev/blog</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          data: toArrayBuffer(nunito),
          name: 'Nunito',
          style: 'normal',
          weight: 700,
        },
        {
          data: toArrayBuffer(geist),
          name: 'Geist',
          style: 'normal',
          weight: 400,
        },
      ],
    },
  );
}
