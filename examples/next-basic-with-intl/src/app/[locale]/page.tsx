'use client';

import { useEdgeStore } from '@/lib/edgestore';
import { useTranslations } from 'next-intl';
import * as React from 'react';

export default function Home() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <div>
        {t('Upload a file and check the console logs for the progress')}
      </div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
        }}
      />
      <button
        onClick={async () => {
          if (file) {
            const res = await edgestore.publicFiles.upload({
              file,
              onProgressChange: (progress) => {
                // you can use this to show a progress bar
                console.log(progress);
              },
            });
            // you can run some server action or api here
            // to add the necessary data to your database
            console.log(res);
          }
        }}
      >
        Upload
      </button>
    </div>
  );
}
