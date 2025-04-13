import { FileUploader } from '@/components/upload/multi-file';
import {
  UploaderProvider,
  useUploader,
  type CompletedFileState,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function MultiImageExample() {
  const { edgestore } = useEdgeStore();

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
    <div className="flex flex-col items-center gap-4">
      <UploaderProvider uploadFn={uploadFn} autoUpload>
        <FileUploader
          maxFiles={10}
          maxSize={1024 * 1024 * 1} // 1 MB
        />
      </UploaderProvider>
      <CompletedFiles />
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
