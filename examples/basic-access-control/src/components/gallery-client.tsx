'use client';

import { useEdgeStore, type ClientResponse } from '@/lib/edgestore';

export function GalleryClient({
  files,
}: {
  files: ClientResponse['privateImages']['listFiles']['data'];
}) {
  const { state } = useEdgeStore();

  if (state.error) {
    return <div>Error</div>;
  }

  if (!state.initialized) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        padding: '1rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '1rem',
      }}
    >
      {files.map((file) => (
        <div key={file.url}>
          <img
            src={file.thumbnailUrl ?? file.url}
            alt="Image"
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'cover',
              borderRadius: '0.5rem',
            }}
          />
        </div>
      ))}
    </div>
  );
}
