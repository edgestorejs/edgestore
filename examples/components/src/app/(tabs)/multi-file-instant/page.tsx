'use client';

import { ExampleFrame } from '@/components/ui/example-frame';
import {
  MultiFileDropzone,
  type FileState,
} from '@/components/upload/multi-file';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<MultiFileInstantDetails />}>
      <MultiImageExample />
    </ExampleFrame>
  );
}

function MultiImageExample() {
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
          maxFiles: 10,
          maxSize: 1024 * 1024 * 1, // 1 MB
        }}
        onFilesAdded={async (addedFiles) => {
          setFileStates([...fileStates, ...addedFiles]);
          await Promise.all(
            addedFiles.map(async (addedFileState) => {
              try {
                const res = await edgestore.myPublicFiles.upload({
                  file: addedFileState.file,
                  onProgressChange: async (progress) => {
                    updateFileProgress(addedFileState.key, progress);
                    if (progress === 100) {
                      // wait 1 second to set it to complete
                      // so that the user can see the progress bar
                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      updateFileProgress(addedFileState.key, 'COMPLETE');
                    }
                  },
                });
                setUploadRes((uploadRes) => [
                  ...uploadRes,
                  {
                    url: res.url,
                    filename: addedFileState.file.name,
                  },
                ]);
              } catch (err) {
                updateFileProgress(addedFileState.key, 'ERROR');
              }
            }),
          );
        }}
      />
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

function MultiFileInstantDetails() {
  return (
    <div className="flex flex-col items-center text-center">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-sm text-gray-300">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/multi-file-instant/page.tsx"
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
      <div className="flex flex-col gap-2 text-justify text-sm text-gray-300">
        <p>
          This component is a dropzone to upload multiple files. It is
          configured with a max file size of 1 MB and a max number of files of
          10.
        </p>
        <p>
          Here we made so that the files are uploaded as soon as they are
          dropped.
        </p>
        <p>
          The EdgeStoreProvider is configured for a maximum of 2 parallel
          uploads. This means that if you upload 5 files, only 2 will be
          uploaded at a time. The other 3 will be queued and uploaded in order
          as soon as one of the first 2 uploads finishes.
        </p>
        <p>
          p.s. The default value for maxParallelUploads is 5. Here we are
          setting it to 2 just to make it easier to see the queue in action.
        </p>
      </div>
    </div>
  );
}
