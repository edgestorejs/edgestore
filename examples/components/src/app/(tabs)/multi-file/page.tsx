'use client';

import { Button } from '@/components/ui/button';
import {
  MultiFileDropzone,
  type FileState,
} from '@/components/upload/multi-file';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function MultiImageTab() {
  const [fileStates, setFileStates] = React.useState<FileState[]>([]);
  const [uploadRes, setUploadRes] = React.useState<
    {
      url: string;
      filename: string;
    }[]
  >([]);
  const { edgestore } = useEdgeStore();

  function updateFileProgress(key: string, progress: FileState['progress']) {
    setFileStates((fileStates) => {
      const newFileStates = structuredClone(fileStates);
      const fileState = newFileStates.find(
        (fileState) => fileState.key === key,
      );
      if (fileState) {
        fileState.progress = progress;
      }
      return newFileStates;
    });
  }

  return (
    <div className="flex flex-col items-center">
      <MultiFileDropzone
        value={fileStates}
        dropzoneOptions={{
          maxFiles: 5,
          maxSize: 1024 * 1024 * 1, // 1 MB
        }}
        onChange={setFileStates}
        onFilesAdded={async (addedFiles) => {
          setFileStates([...fileStates, ...addedFiles]);
        }}
      />
      <Button
        className="mt-2"
        onClick={async () => {
          await Promise.all(
            fileStates.map(async (fileState) => {
              try {
                if (fileState.progress !== 'PENDING') return;
                const res = await edgestore.myPublicFiles.upload({
                  file: fileState.file,
                  onProgressChange: async (progress) => {
                    updateFileProgress(fileState.key, progress);
                    if (progress === 100) {
                      // wait 1 second to set it to complete
                      // so that the user can see the progress bar
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      updateFileProgress(fileState.key, 'COMPLETE');
                    }
                  },
                });
                setUploadRes((uploadRes) => [
                  ...uploadRes,
                  {
                    url: res.url,
                    filename: fileState.file.name,
                  },
                ]);
              } catch (err) {
                updateFileProgress(fileState.key, 'ERROR');
              }
            }),
          );
        }}
        disabled={
          !fileStates.filter((fileState) => fileState.progress === 'PENDING')
            .length
        }
      >
        Upload
      </Button>
      {uploadRes.length > 0 && (
        <div className="mt-2">
          {uploadRes.map((res) => (
            <a
              key={res.url}
              className="mt-2 block"
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
