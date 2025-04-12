'use client';

import * as React from 'react';
import { SingleImageDropzone } from '../single-image';
import { UploaderProvider } from '../uploader-provider';

export function SingleImageDropzoneUsage() {
  return (
    <>
      <UploaderProvider
        uploadFn={() =>
          Promise.resolve({ url: 'https://edgestore.dev/img/logo.png' })
        }
      >
        <SingleImageDropzone width={200} height={200} />
      </UploaderProvider>
    </>
  );
}
