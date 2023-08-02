'use client';

import { Button } from '@/components/ui/button';
import { SingleImageDropzone } from '@/components/upload/single-image';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function SingleImageTab() {
  const [file, setFile] = React.useState<File | undefined>(undefined);
  const [progress, setProgress] = React.useState<
    'PENDING' | 'COMPLETE' | 'ERROR' | number
  >('PENDING');
  const { edgestore } = useEdgeStore();

  return (
    <div className="flex flex-col items-center">
      <SingleImageDropzone
        height={200}
        width={200}
        value={file}
        onChange={setFile}
        disabled={progress !== 'PENDING'}
      />
      <Button
        className="mt-2"
        onClick={async () => {
          if (file) {
            try {
              await edgestore.myPublicImages.upload({
                file,
                onProgressChange: async (newProgress) => {
                  setProgress(newProgress);
                  if (newProgress === 100) {
                    // wait 1 second to set it to complete
                    // so that the user can see it at 100%
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    setProgress('COMPLETE');
                  }
                },
              });
            } catch (err) {
              setProgress('ERROR');
            }
          }
        }}
        disabled={!file || progress !== 'PENDING'}
      >
        {progress === 'PENDING'
          ? 'Upload'
          : progress === 'COMPLETE'
          ? 'Done'
          : typeof progress === 'number'
          ? `Uploading (${Math.round(progress)}%)`
          : 'Error'}
      </Button>
    </div>
  );
}
