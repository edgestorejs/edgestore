'use client';

import { ExampleFrame } from '@/components/ui/example-frame';
import { SingleImageDropzone } from '@/components/upload/single-image';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import * as React from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<SingleImageDetails />} centered>
      <SingleImageExample />
    </ExampleFrame>
  );
}

function SingleImageExample() {
  const [uploadRes, setUploadRes] = React.useState<{
    name: string;
    url: string;
  }>();
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, onProgressChange, signal }) => {
      const res = await edgestore.myPublicImages.upload({
        file,
        signal,
        onProgressChange,
      });
      setUploadRes({
        name: file.name,
        url: res.url,
      });
      return res;
    },
    [edgestore],
  );

  return (
    <UploaderProvider uploadFn={uploadFn} autoUpload>
      <div className="flex flex-col items-center">
        <SingleImageDropzone
          height={200}
          width={200}
          dropzoneOptions={{
            maxSize: 1024 * 1024 * 1, // 1 MB
          }}
        />
        {uploadRes && (
          <div className="mt-2">
            <a
              href={uploadRes.url}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {uploadRes.name}
            </a>
          </div>
        )}
      </div>
    </UploaderProvider>
  );
}

function SingleImageDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-sm text-foreground/80">
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
      <div className="text-sm text-foreground/80">
        <p>
          This component is a dropzone to upload an image. It is configured with
          a max file size of 1 MB. And since it&apos;s using an EdgeStore image
          bucket, it will only accept images.
        </p>
      </div>
      <table className="mt-2 inline-block text-xs text-foreground/80">
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
