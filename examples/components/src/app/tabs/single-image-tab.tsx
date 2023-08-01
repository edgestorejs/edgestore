'use client';

import { Button } from '@/components/ui/button';
import { SingleImageDropzone } from '@/components/upload/single-image';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function SingleImageTab() {
  const [file, setFile] = React.useState<File | undefined>(undefined);
  const { edgestore } = useEdgeStore();

  return (
    <div className="flex flex-col items-center">
      <SingleImageDropzone
        height={200}
        width={200}
        value={file}
        onChange={setFile}
      />
      <Button
        className="mt-2"
        onClick={async () => {
          if (file) {
            await edgestore.myPublicImages.upload({
              file,
              onProgressChange: console.log,
            });
          }
        }}
      >
        Upload
      </Button>
    </div>
  );
}
