'use-client';

import * as React from 'react';
import { MultiImageDropzone, type FileState } from './MultiImageDropzone';

export function MultiImageDropzoneUsage() {
  const [fileStates, setFileStates] = React.useState<FileState[]>([]);

  return (
    <>
      <MultiImageDropzone
        value={fileStates}
        dropzoneOptions={{
          maxFiles: 6,
        }}
        onChange={(files) => {
          setFileStates(files);
        }}
      />
    </>
  );
}
