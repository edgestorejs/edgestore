'use-client';

import * as React from 'react';
import { ImageUploader } from '../multi-image';
import { UploaderProvider } from '../uploader-provider';

export function MultiImageDropzoneUsage() {
  return (
    <>
      <UploaderProvider
        uploadFn={() =>
          Promise.resolve({ url: 'https://edgestore.dev/img/logo.png' })
        }
      >
        <ImageUploader maxFiles={6} maxSize={1024 * 1024 * 1} />
      </UploaderProvider>
    </>
  );
}
