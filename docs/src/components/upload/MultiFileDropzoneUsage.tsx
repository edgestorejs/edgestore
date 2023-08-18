'use-client';

import * as React from 'react';
import { FileState, MultiFileDropzone } from './MultiFileDropzone';

export function MultiFileDropzoneUsage() {
  const [fileStates, setFileStates] = React.useState<FileState[]>([]);

  return (
    <>
      <MultiFileDropzone
        value={fileStates}
        onChange={(files) => {
          setFileStates(files);
        }}
      />
    </>
  );
}
