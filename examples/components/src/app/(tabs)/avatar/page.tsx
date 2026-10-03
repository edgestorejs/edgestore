'use client';

import { ExampleFrame } from '@/components/ui/example-frame';
import { AvatarDropzone } from '@/components/upload/avatar-dropzone';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import { BuildingIcon } from 'lucide-react';
import * as React from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<AvatarDetails />} centered>
      <AvatarExample />
    </ExampleFrame>
  );
}

function AvatarExample() {
  const { edgestore } = useEdgeStore();

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, onProgressChange, signal }) => {
      return edgestore.myPublicImages.upload({
        file,
        signal,
        onProgressChange,
      });
    },
    [edgestore],
  );

  return (
    <div className="flex flex-col gap-8">
      <UploaderProvider uploadFn={uploadFn} autoUpload>
        <AvatarDropzone
          label="Profile photo"
          maxSize={1024 * 1024 * 2} // 2 MB
          minDimension={128}
        />
      </UploaderProvider>
      <UploaderProvider uploadFn={uploadFn} autoUpload>
        <AvatarDropzone
          label="Workspace logo"
          shape="square"
          size={64}
          maxSize={1024 * 1024 * 2} // 2 MB
          minDimension={64}
          placeholder={<BuildingIcon className="size-6" strokeWidth={1.5} />}
        />
      </UploaderProvider>
    </div>
  );
}

function AvatarDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-sm text-foreground/80">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/avatar/page.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Usage
          </a>
        </li>
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/components/upload/avatar-dropzone.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Component
          </a>
        </li>
      </ul>
      <h3 className="mt-4 text-base font-bold">About</h3>
      <div className="flex flex-col gap-2 text-sm text-foreground/80">
        <p>
          A single image in a fixed shape, for profile photos and logos. Click
          or drop onto the image to replace it.
        </p>
        <p>
          It checks the image&apos;s pixel size in the browser before uploading,
          so images that are too small are rejected right away.
        </p>
      </div>
    </div>
  );
}
