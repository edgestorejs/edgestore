import { FileUploader } from '@/components/upload/multi-file';
import {
  UploaderProvider,
  useUploader,
  type CompletedFileState,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import * as React from 'react';

export default function FileUploaderBlock() {
  const { edgestore } = useMockEdgeStore(); // Mock edgestore for easy v0 integration

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, signal, onProgressChange }) => {
      const res = await edgestore.myPublicFiles.upload({
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
          <FileUploader
            maxFiles={10}
            maxSize={1024 * 1024 * 1} // 1 MB
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
    <div className="mt-8 w-full">
      <h3 className="mb-2 text-lg font-semibold">Uploaded Files</h3>
      <div className="rounded-md bg-gray-50 p-4 dark:bg-gray-900">
        {completedFiles.map((res) => (
          <a
            key={res.url}
            className="mb-1 block underline"
            href={res.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {res.file.name}
          </a>
        ))}
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

          console.log('Simulated upload of', file.name);

          return {
            url: 'https://edgestore.dev/img/upload-demo.webp',
          };
        },
      },
    },
  };
}
