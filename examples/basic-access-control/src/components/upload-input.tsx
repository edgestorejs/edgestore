'use client';

import { useEdgeStore } from '@/lib/edgestore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function UploadInput() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
        }}
      />
      <button
        onClick={async () => {
          if (file) {
            const res = await edgestore.privateImages.upload({
              file,
              input: {
                type: 'post',
              },
              onProgressChange: (progress) => {
                // you can use this to show a progress bar
                console.log(progress);
              },
            });
            // you can run some server action or api here
            // to add the necessary data to your database
            console.log(res);

            // wait for the file to be processed
            await new Promise((resolve) => setTimeout(resolve, 1000));
            router.refresh();
          }
        }}
        disabled={!file}
      >
        Upload
      </button>
    </div>
  );
}
