'use client';

import { Button } from '@/components/ui/button';
import { ExampleFrame } from '@/components/ui/example-frame';
import { FileUploader } from '@/components/upload/multi-file';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import { UploadCloudIcon } from 'lucide-react';
import * as React from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<MultiFileDetails />} centered>
      <MultiFileExample />
    </ExampleFrame>
  );
}

type UploadResult = {
  url: string;
  filename: string;
};

function MultiFileExample() {
  const [uploadRes, setUploadRes] = React.useState<UploadResult[]>([]);
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      const res = await edgestore.myPublicFiles.upload({
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
    },
    [edgestore],
  );

  return (
    <div className="flex flex-col items-center">
      <UploaderProvider uploadFn={uploadFn}>
        {({ isUploading, uploadFiles, fileStates, resetFiles }) => (
          <div className="w-full space-y-4">
            <FileUploader
              maxFiles={5}
              maxSize={1024 * 1024 * 1} // 1 MB
            />
            <Button
              variant="outline"
              onClick={uploadFiles}
              className="flex items-center gap-2 pl-3"
              disabled={
                isUploading ||
                !fileStates.some((file) => file.status === 'PENDING')
              }
            >
              <UploadCloudIcon className="h-4 w-4" />
              <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
            </Button>

            {/* Uploaded Files */}
            {uploadRes.length > 0 && (
              <div className="mt-8 w-full">
                <h3 className="mb-2 text-lg font-semibold">Uploaded Files</h3>
                <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-900">
                  {uploadRes.map((res) => (
                    <a
                      key={res.url}
                      className="mb-1 block underline"
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {res.filename}
                    </a>
                  ))}
                </div>
                <Button
                  className="mt-3"
                  variant="outline"
                  onClick={() => {
                    setUploadRes([]);
                    resetFiles();
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </UploaderProvider>
    </div>
  );
}

function MultiFileDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-foreground/80 text-sm">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/multi-file/page.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Usage
          </a>
        </li>
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/components/upload/multi-file.tsx"
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
          This component is a dropzone to upload multiple files. It is
          configured with a max file size of 1 MB and a max number of files of
          5.
        </p>
        <p>
          Here, the EdgeStoreProvider is configured for a maximum of 2 parallel
          uploads. This means that if you upload 5 files, only 2 will be
          uploaded at a time. The other 3 will be queued and uploaded in order
          as soon as one of the first 2 uploads finishes.
        </p>
        <p>
          Additionally, a custom trigger for the upload process and a custom
          clear button are implemented using the provider methods. This allows
          for more control over the upload and reset actions directly from the
          UI.
        </p>
        <p>
          p.s. The default value for maxParallelUploads is 5. Here we are
          setting it to 2 just to make it easier to see the queue in action.
        </p>
      </div>
    </div>
  );
}
