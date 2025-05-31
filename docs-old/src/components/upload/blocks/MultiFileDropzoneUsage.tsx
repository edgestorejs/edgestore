'use-client';

import * as React from 'react';
import { FileUploader } from '../multi-file';
import { UploaderProvider } from '../uploader-provider';

export function MultiFileDropzoneUsage() {
  return (
    <>
      <UploaderProvider
        uploadFn={() =>
          Promise.resolve({ url: 'https://edgestore.dev/img/logo.png' })
        }
      >
        <FileUploader maxFiles={6} maxSize={1024 * 1024 * 1} />
      </UploaderProvider>
    </>
  );
}
