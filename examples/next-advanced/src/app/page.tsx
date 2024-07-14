'use client';

import { useEdgeStore } from '@/lib/edgestore';
import {
  EdgeStoreApiClientError,
  UploadAbortedError,
} from '@edgestore/react/errors';
import { formatFileSize } from '@edgestore/react/utils';
import { useState } from 'react';

export default function Home() {
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState<number>();
  const [uploadedUrl, setUploadedUrl] = useState<string>();
  const [abortController, setAbortController] = useState<AbortController>();
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0]);
        }}
      />
      <button
        onClick={async () => {
          try {
            if (file) {
              const abortController = new AbortController();
              setAbortController(abortController);
              const res = await edgestore.publicFiles.upload({
                file,
                signal: abortController.signal,
                input: {
                  type: 'post',
                },
                onProgressChange: (progress) => {
                  setProgress(progress);
                },
              });
              // you can run some server action or api here
              // to add the necessary data to your database
              console.log(res);
              setUploadedUrl(res.url);
            }
          } catch (error) {
            setProgress(undefined);
            if (error instanceof EdgeStoreApiClientError) {
              if (error.data.code === 'FILE_TOO_LARGE') {
                alert(
                  `File too large. Max size is ${formatFileSize(
                    error.data.details.maxFileSize,
                  )}`,
                );
              }
              if (error.data.code === 'MIME_TYPE_NOT_ALLOWED') {
                alert(
                  `File type not allowed. Allowed types are ${error.data.details.allowedMimeTypes.join(
                    ', ',
                  )}`,
                );
              }
              if (error.data.code === 'UPLOAD_NOT_ALLOWED') {
                alert("You don't have permission to upload files here.");
              }
            } else if (error instanceof UploadAbortedError) {
              console.log('Upload aborted');
            } else {
              console.error(error);
            }
          }
        }}
        disabled={!file || !!uploadedUrl}
      >
        Upload
      </button>
      <button
        disabled={
          !abortController || progress === 100 || progress === undefined
        }
        onClick={async () => {
          abortController?.abort();
          setProgress(undefined);
        }}
      >
        Cancel
      </button>
      <button
        disabled={!uploadedUrl}
        onClick={async () => {
          if (uploadedUrl) {
            try {
              await edgestore.publicFiles.delete({
                url: uploadedUrl,
              });
              console.log('File deleted');
              setUploadedUrl(undefined);
              setProgress(undefined);
            } catch (error) {
              if (error instanceof EdgeStoreApiClientError) {
                if (error.data.code === 'DELETE_NOT_ALLOWED') {
                  alert("You don't have permission to delete this file.");
                }
              }
            }
          }
        }}
      >
        Delete
      </button>
      {progress !== undefined && <div>{progress}%</div>}
    </div>
  );
}
