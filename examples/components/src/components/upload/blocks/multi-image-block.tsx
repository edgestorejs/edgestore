'use client';

import { ImageUploader } from '@/components/upload/multi-image';
import {
  UploaderProvider,
  useUploader,
  type CompletedFileState,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import * as React from 'react';

export default function MultiImageUploaderBlock() {
  const { edgestore } = useMockEdgeStore(); // Mock edgestore for easy v0 integration

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      const res = await edgestore.myPublicImages.upload({
        file,
        signal,
        onProgressChange,
      });
      // you can run some server action or api here
      // to add the necessary data to your database
      return { url: res.url };
    },
    [edgestore],
  );

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="w-full max-w-md">
        <UploaderProvider uploadFn={uploadFn} autoUpload>
          <ImageUploader
            maxFiles={6}
            maxSize={1024 * 1024 * 2} // 2MB
          />
          <CompletedFiles />
        </UploaderProvider>
      </div>
    </div>
  );
}

function CompletedFiles() {
  const { fileStates } = useUploader();

  const completedFiles = fileStates.filter(
    (fs): fs is CompletedFileState => fs.status === 'COMPLETE',
  );

  if (completedFiles.length === 0) {
    return null;
  }

  return (
    <div className="mt-6 w-full">
      <h3 className="mb-2 text-sm font-semibold">Uploaded files</h3>
      <ul className="grid gap-1 rounded-lg bg-muted/50 p-3 text-sm">
        {completedFiles.map((fs) => (
          <li key={fs.key} className="truncate">
            <a
              className="underline underline-offset-2"
              href={fs.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {fs.file.name}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Mock implementation of EdgeStore
function useMockEdgeStore() {
  return {
    edgestore: {
      myPublicImages: {
        upload: async ({
          signal,
          onProgressChange,
        }: {
          file: File;
          signal?: AbortSignal;
          onProgressChange?: (progress: number) => void | Promise<void>;
        }) => {
          // Simulate upload progress. Rejects like EdgeStore when the upload is aborted.
          await new Promise<void>((resolve, reject) => {
            let progress = 0;
            const interval = setInterval(() => {
              progress = Math.min(
                progress + Math.floor(Math.random() * 21) + 10,
                100,
              );
              void onProgressChange?.(progress);
              if (progress >= 100) {
                clearInterval(interval);
                resolve();
              }
            }, 300);
            signal?.addEventListener('abort', () => {
              clearInterval(interval);
              reject(new DOMException('Upload aborted', 'AbortError'));
            });
          });

          return {
            url: 'https://edgestore.dev/img/upload-demo.webp',
          };
        },
      },
    },
  };
}
