'use client';

import { ExampleFrame } from '@/components/ui/example-frame';
import { ImageUploader } from '@/components/upload/multi-image';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<MultiImageDetails />} centered>
      <MultiImageExample />
    </ExampleFrame>
  );
}

function MultiImageExample() {
  const [uploadRes, setUploadRes] = React.useState<
    {
      url: string;
      filename: string;
    }[]
  >([]);
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, onProgressChange, signal }) => {
      const res = await edgestore.myPublicImages.upload({
        file,
        signal,
        onProgressChange,
      });

      setUploadRes((prev) => [
        ...prev,
        {
          url: res.url,
          filename: file.name,
        },
      ]);

      return res;
    },
    [edgestore],
  );

  return (
    <div className="flex flex-col">
      <UploaderProvider uploadFn={uploadFn} autoUpload>
        <ImageUploader
          maxFiles={6}
          maxSize={1024 * 1024 * 1} // 1 MB
        />
      </UploaderProvider>

      {uploadRes.length > 0 && (
        <div className="mt-2">
          {uploadRes.map((res) => (
            <a
              key={res.url}
              className="mt-2 block underline"
              href={res.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {res.filename}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiImageDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-foreground/80 text-sm">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/multi-image/page.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Usage
          </a>
        </li>
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/components/upload/multi-image.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Component
          </a>
        </li>
      </ul>
      <h3 className="mt-4 text-base font-bold">About</h3>
      <div className="text-foreground/80 flex flex-col gap-2 text-sm">
        <p>
          This component is a dropzone to upload multiple images. It is
          configured with a max file size of 1 MB and a max number of files of
          6.
        </p>
        <p>
          Here, the EdgeStoreProvider is configured for a maximum of 2 parallel
          uploads. This means that if you upload 6 files, only 2 will be
          uploaded at a time. The rest will be queued and uploaded in order as
          soon as one of the first 2 uploads finishes.
        </p>
        <p>
          p.s. The default value for maxParallelUploads is 5. Here we are
          setting it to 2 just to make it easier to see the queue in action.
        </p>
      </div>
    </div>
  );
}
