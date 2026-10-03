'use client';

import { UploadErrors } from '@/components/upload/dropzone';
import { FileList } from '@/components/upload/multi-file';
import { UploadButton } from '@/components/upload/upload-button';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { PaperclipIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';

export default function UploadButtonBlock() {
  const [errors, setErrors] = React.useState<string[]>([]);
  const { edgestore } = useMockEdgeStore(); // Mock edgestore for easy v0 integration

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      const res = await edgestore.myPublicFiles.upload({
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
      <div className="flex w-full max-w-md flex-col gap-4">
        <UploaderProvider uploadFn={uploadFn} autoUpload>
          <div className="flex items-center gap-2">
            <UploadButton
              maxSize={1024 * 1024 * 1} // 1 MB
              onRejected={setErrors}
            >
              <UploadIcon /> Upload files
            </UploadButton>
            <UploadButton
              variant="outline"
              size="icon"
              aria-label="Attach files"
              maxSize={1024 * 1024 * 1} // 1 MB
              onRejected={setErrors}
            >
              <PaperclipIcon />
            </UploadButton>
          </div>
          <UploadErrors errors={errors} onDismiss={() => setErrors([])} />
          <FileList />
        </UploaderProvider>
      </div>
    </div>
  );
}

// Mock implementation of EdgeStore
function useMockEdgeStore() {
  return {
    edgestore: {
      myPublicFiles: {
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
