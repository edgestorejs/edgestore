import { ImageUploader } from '@/components/upload/multi-image';
import {
  UploaderProvider,
  useUploader,
  type CompletedFileState,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import * as React from 'react';

export default function MultiImageUploaderBlock() {
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
          <ImageUploader
            maxFiles={6}
            maxSize={1024 * 1024 * 2} // 2MB
          />
          <CompletedImages />
        </UploaderProvider>
      </div>
    </div>
  );
}

function CompletedImages() {
  const { fileStates } = useUploader();

  const completedFiles = fileStates.filter(
    (fs): fs is CompletedFileState => fs.status === 'COMPLETE',
  );

  if (completedFiles.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 w-full">
      <h3 className="mb-2 text-lg font-semibold">Uploaded Images</h3>
      <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-4 dark:bg-gray-900">
        {completedFiles.map((file) => (
          <a
            key={file.url}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-square overflow-hidden rounded-md"
          >
            <img
              src={file.url}
              alt={file.file.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-110"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="truncate text-xs text-white">
                {file.file.name}
              </span>
            </div>
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
