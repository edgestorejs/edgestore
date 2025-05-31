'use client';

import { SingleImageDropzone } from '@/components/upload/single-image';
import {
  UploaderProvider,
  useUploader,
  type CompletedFileState,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import * as React from 'react';

export default function SingleImageUploaderBlock() {
  const { edgestore } = useMockEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      const res = await edgestore.myPublicImages.upload({
        file,
        signal,
        onProgressChange,
      });
      return { url: res.url };
    },
    [edgestore],
  );

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="w-full max-w-md">
        <UploaderProvider uploadFn={uploadFn} autoUpload>
          <SingleImageDropzone
            width={200}
            height={200}
            dropzoneOptions={{ maxSize: 1024 * 1024 * 2 }} // 2MB
          />
          <CompletedImage />
        </UploaderProvider>
      </div>
    </div>
  );
}

function CompletedImage() {
  const { fileStates } = useUploader();

  const completedFile = fileStates.find(
    (fs): fs is CompletedFileState => fs.status === 'COMPLETE',
  );

  if (!completedFile) {
    return null;
  }

  return (
    <div className="mt-8 w-full">
      <h3 className="mb-2 text-lg font-semibold">Uploaded Image</h3>
      <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-900">
        <div className="flex flex-col items-center">
          <a
            href={completedFile.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {completedFile.file.name}
          </a>
        </div>
      </div>
    </div>
  );
}

// Mock implementation of EdgeStore
function useMockEdgeStore() {
  return {
    edgestore: {
      myPublicImages: {
        upload: async ({
          file,
          onProgressChange,
        }: {
          file: File;
          signal?: AbortSignal;
          onProgressChange?: (progress: number) => void | Promise<void>;
        }) => {
          // Simulate upload progress with a Promise that completes only after reaching 100%
          await new Promise<void>((resolve) => {
            if (onProgressChange) {
              let progress = 0;
              const interval = setInterval(() => {
                const increment = Math.floor(Math.random() * 41) + 10;
                progress = Math.min(progress + increment, 100);
                void onProgressChange(progress);

                if (progress >= 100) {
                  clearInterval(interval);
                  setTimeout(() => {
                    void onProgressChange(100);
                    setTimeout(resolve, 200);
                  }, 300);
                }
              }, 300);
            } else {
              // If no progress handler, just wait a bit
              setTimeout(resolve, 1500);
            }
          });

          return {
            url: `https://mock-edgestore.example.com/${file.name}`,
          };
        },
      },
    },
  };
}
