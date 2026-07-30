import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useEdgeStore } from '../utils/edgestore';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const { edgestore } = useEdgeStore();

  return (
    <main>
      <h1>EdgeStore with TanStack Start</h1>
      <p>Select a file and upload it through the EdgeStore Start adapter.</p>
      <input
        type="file"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setProgress(0);
        }}
      />
      <button
        disabled={!file}
        onClick={async () => {
          if (!file) return;
          await edgestore.publicFiles.upload({
            file,
            onProgressChange: setProgress,
          });
        }}
      >
        Upload
      </button>
      <output>{progress}%</output>
    </main>
  );
}
