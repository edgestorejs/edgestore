'use client';

import { useEdgeStore } from '@/lib/edgestore';
import { EdgeStoreApiClientError } from '@edgestore/react/shared';
import { formatFileSize } from '@edgestore/react/utils';
import * as React from 'react';

export default function Home() {
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = React.useState<string | null>(null);
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
        }}
      />
      <button
        onClick={async () => {
          try {
            if (file) {
              const res = await edgestore.publicFiles.upload({
                file,
                input: {
                  type: 'post',
                },
                onProgressChange: (progress) => {
                  // you can use this to show a progress bar
                  console.log(progress);
                },
              });
              // you can run some server action or api here
              // to add the necessary data to your database
              console.log(res);
              setUploadedUrl(res.url);
            }
          } catch (error) {
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
            }
          }
        }}
        disabled={!file || !!uploadedUrl}
      >
        Upload
      </button>
      <button
        className="rounded-md bg-gray-200 p-1 px-3 text-black hover:bg-gray-300 disabled:pointer-events-none disabled:opacity-50"
        disabled={!uploadedUrl}
        onClick={async () => {
          if (uploadedUrl) {
            try {
              await edgestore.publicFiles.delete({
                url: uploadedUrl,
              });
              setUploadedUrl(null);
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
    </div>
  );
}
