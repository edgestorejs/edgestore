'use client';

import { ExampleFrame } from '@/components/ui/example-frame';
import { UploadErrors } from '@/components/upload/dropzone';
import { FileList } from '@/components/upload/multi-file';
import { UploadButton } from '@/components/upload/upload-button';
import { SPREADSHEET_ACCEPT } from '@/components/upload/upload-utils';
import {
  UploaderProvider,
  type UploadFn,
} from '@/components/upload/uploader-provider';
import { useEdgeStore } from '@/lib/edgestore';
import { PaperclipIcon, TableIcon, UploadIcon } from 'lucide-react';
import * as React from 'react';

export default function Page() {
  return (
    <ExampleFrame details={<ButtonsDetails />} centered>
      <ButtonsExample />
    </ExampleFrame>
  );
}

function ButtonsExample() {
  const { edgestore } = useEdgeStore();
  const [errors, setErrors] = React.useState<string[]>([]);

  const uploadFn: UploadFn = React.useCallback(
    async ({ file, onProgressChange, signal }) => {
      return edgestore.myPublicFiles.upload({
        file,
        signal,
        onProgressChange,
      });
    },
    [edgestore],
  );

  return (
    <UploaderProvider uploadFn={uploadFn} autoUpload>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <UploadButton
            maxSize={1024 * 1024 * 1} // 1 MB
            onRejected={setErrors}
          >
            <UploadIcon /> Upload files
          </UploadButton>
          <UploadButton
            variant="outline"
            accept={SPREADSHEET_ACCEPT}
            typesLabel="CSV or Excel"
            multiple={false}
            maxSize={1024 * 1024 * 1} // 1 MB
            onRejected={setErrors}
          >
            <TableIcon /> Import CSV
          </UploadButton>
          <UploadButton
            variant="outline"
            size="icon"
            aria-label="Attach files"
            maxSize={1024 * 1024 * 1} // 1 MB
            onRejected={setErrors}
          >
            <PaperclipIcon />
          </UploadButton>
        </div>
        <UploadErrors errors={errors} onDismiss={() => setErrors([])} />
        <FileList />
      </div>
    </UploaderProvider>
  );
}

function ButtonsDetails() {
  return (
    <div className="flex flex-col">
      <h3 className="mt-4 text-base font-bold">See in GitHub</h3>
      <ul className="text-sm text-foreground/80">
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/app/(tabs)/buttons/page.tsx"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Usage
          </a>
        </li>
        <li>
          <a
            href="https://github.com/edgestorejs/edgestore/blob/main/examples/components/src/components/upload/upload-button.tsx"
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
          Buttons that open the file dialog and also accept files dropped onto
          them. Each button highlights while you drag a file over it.
        </p>
        <p>
          All three buttons feed the same uploader, so the files end up in one
          list.
        </p>
      </div>
    </div>
  );
}
