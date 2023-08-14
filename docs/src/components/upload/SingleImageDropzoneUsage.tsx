import * as React from 'react';
import { SingleImageDropzone } from './SingleImageDropzone';

export function SingleImageDropzoneUsage() {
  const [file, setFile] = React.useState<File>();

  return (
    <>
      <SingleImageDropzone
        width={200}
        height={200}
        value={file}
        onChange={(file) => {
          setFile(file);
        }}
      />
    </>
  );
}
