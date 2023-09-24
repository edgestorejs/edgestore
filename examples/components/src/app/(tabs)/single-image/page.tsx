'use client';

import { Button } from '@/components/ui/button';
import { ExampleFrame } from '@/components/ui/example-frame';
import { SingleImageDropzone } from '@/components/upload/single-image';
import { useEdgeStore } from '@/lib/edgestore';
import { useState } from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<SingleImageDetails />}>
      <SingleImageExample />
    </ExampleFrame>
  );
}

function SingleImageExample() {
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState<
    'PENDING' | 'COMPLETE' | 'ERROR' | number
  >('PENDING');
  const [uploadRes, setUploadRes] = useState<{
    url: string;
    filename: string;
  }>();
  const { edgestore } = useEdgeStore();

  return (
    <div className="flex flex-col items-center">
      <SingleImageDropzone
        height={200}
        width={200}
        value={file}
        onChange={setFile}
        disabled={progress !== 'PENDING'}
        dropzoneOptions={{
          maxSize: 1024 * 1024 * 1, // 1 MB
        }}
      />
      <Button
        className="mt-2"
        onClick={async () => {
          if (file) {
            try {
              const res = await edgestore.myPublicImages.upload({
                file,
                onProgressChange: async (newProgress) => {
                  setProgress(newProgress);
                  if (newProgress === 100) {
                    // wait 1 second to set it to complete
                    // so that the user can see it at 100%
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    setProgress('COMPLETE');
                  }
                },
              });
              setUploadRes({
                url: res.url,
                filename: file.name,
              });
            } catch (err) {
              setProgress('ERROR');
            }
          }
        }}
        disabled={!file || progress !== 'PENDING'}
      >
        {progress === 'PENDING'
          ? 'Upload'
          : progress === 'COMPLETE'
          ? 'Done'
          : typeof progress === 'number'
          ? `Uploading (${Math.round(progress)}%)`
          : 'Error'}
      </Button>
      {uploadRes && (
        <div className="mt-2">
          <a
            href={uploadRes.url}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {uploadRes.filename}
          </a>
        </div>
      )}
    </div>
  );
}

function SingleImageDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-foreground/80 text-sm">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/single-image/page.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Usage
          </a>
        </li>
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/components/upload/single-image.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Component
          </a>
        </li>
      </ul>
      <h3 className="mt-4 text-base font-bold">About</h3>
      <div className="text-foreground/80 text-sm">
        <p>
          This component is a dropzone to upload an image. It is configured with
          a max file size of 1 MB. And since it&apos;s using an Edge Store image
          bucket, it will only accept images.
        </p>
      </div>
      <table className="text-foreground/80 mt-2 inline-block text-xs">
        <tbody>
          <tr className="border">
            <td className="p-1">image/jpeg</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/png</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/gif</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/webp</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/svg+xml</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/tiff</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/bmp</td>
          </tr>
          <tr className="border">
            <td className="p-1">image/x-icon</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
