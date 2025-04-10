'use-client';

import * as React from 'react';
import { FileUploader } from '../multi-file';
import { UploaderProvider } from '../uploader-provider';

export function MultiFileDropzoneUsage() {
  return (
    <>
      <UploaderProvider
        uploadFn={() => Promise.resolve({ url: 'https://example.com' })}
      >
        <FileUploader />
      </UploaderProvider>
    </>
  );
}
