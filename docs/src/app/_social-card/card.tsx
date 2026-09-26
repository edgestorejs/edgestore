import { readFile } from 'node:fs/promises';
import { ImageResponse } from 'next/og';

type SocialCardOptions = {
  badge?: string;
  description?: string;
  footerLeft: string;
  footerRight: string;
  title: string;
};

const assetsPromise = Promise.all([
  readFile(new URL('./assets/nunito-bold.ttf', import.meta.url)),
  readFile(new URL('./assets/geist-regular.ttf', import.meta.url)),
  readFile(new URL('../../../public/img/logo-sm.png', import.meta.url)),
  readFile(new URL('../../../public/img/edgestore.svg', import.meta.url)),
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

export async function createSocialCard({
  badge,
  description,
  footerLeft,
  footerRight,
  title,
}: SocialCardOptions): Promise<ImageResponse> {
  const [nunito, geist, logo, wordmark] = await assetsPromise;

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

        {badge ? (
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
            {badge}
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
            fontSize: getTitleFontSize(title),
            fontWeight: 700,
            letterSpacing: '-0.025em',
            lineHeight: 1.02,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              color: '#aeb6c5',
              display: 'flex',
              fontSize: getDescriptionFontSize(description),
              lineHeight: 1.35,
              maxWidth: 920,
            }}
          >
            {description}
          </div>
        ) : null}
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
        <div style={{ display: 'flex' }}>{footerLeft}</div>
        <div style={{ display: 'flex' }}>{footerRight}</div>
      </div>
    </div>,
    {
      height: 630,
      width: 1200,
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
