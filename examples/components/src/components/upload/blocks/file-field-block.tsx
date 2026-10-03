'use client';

import { FileField } from '@/components/upload/file-field';
import { DOCUMENT_ACCEPT } from '@/components/upload/upload-utils';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import * as React from 'react';

export default function FileFieldBlock() {
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
      <div className="grid w-full max-w-md gap-1.5">
        <label
          id="resume-label"
          htmlFor="resume-input"
          className="text-sm font-medium"
        >
          Resume
        </label>
        <UploaderProvider uploadFn={uploadFn} autoUpload>
          <FileField
            inputId="resume-input"
            aria-labelledby="resume-label"
            accept={DOCUMENT_ACCEPT}
            typesLabel="PDF, DOC or DOCX"
            maxSize={1024 * 1024 * 5} // 5MB
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
