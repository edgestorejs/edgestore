'use client';

import { AvatarDropzone } from '@/components/upload/avatar-dropzone';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import * as React from 'react';

export default function AvatarDropzoneBlock() {
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
          <AvatarDropzone
            label="Profile photo"
            maxSize={1024 * 1024 * 2} // 2MB
            minDimension={128}
          />
        </UploaderProvider>
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
