'use client';

import { useUploader } from '@/components/upload/uploader-provider';
import { cn } from '@/lib/utils';
import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import UploadIcon from './upload-icon';

export function NeonDropzone() {
  const { addFiles, fileStates } = useUploader();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]!;
        addFiles([file]);
      }
    },
    [addFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: 1024 * 1024 * 5, // 5MB
    multiple: false,
    disabled: fileStates.length > 0,
  });

  const selectedFile = fileStates[0];

  return (
    <div
      {...getRootProps()}
      className={cn(
        '@container relative h-full w-full max-w-[600px] select-none place-self-center transition-all duration-300',
        isDragActive && 'scale-105',
      )}
    >
      {/* Window dots container - completely separate from the main container */}
      <div className="absolute z-10 m-[3px] flex gap-3 p-4">
        <div className="h-4 w-4 rounded-full bg-gradient-to-r from-red-200 to-red-400 drop-shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
        <div className="h-4 w-4 rounded-full bg-gradient-to-r from-orange-200 to-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
        <div className="h-4 w-4 rounded-full bg-gradient-to-r from-cyan-200 to-cyan-400 drop-shadow-[0_0_12px_rgba(45,212,191,0.9)]" />
      </div>

      {/* Main container with drop shadow */}
      <div className="border-3 flex h-full w-full flex-col rounded-2xl border-violet-200 text-violet-200 drop-shadow-[0_0_5px_rgba(225,42,251,1),0_0_15px_rgba(225,42,251,.5)]">
        <div className="h-12" /> {/* Spacer for dots */}
        <div className="ml-[-1px] h-[3px] w-[calc(100%+2px)] bg-violet-200" />
        {/* Dropzone */}
        <div
          className={cn(
            'border-3 @min-[500px]:h-[190px] m-6 flex h-[150px] grow flex-col items-center justify-center rounded-xl border-dashed border-fuchsia-200/80 transition-all duration-300',
            isDragActive && 'drop-shadow-[0_0_15px_rgba(225,42,251,.3)]',
          )}
        >
          <input {...getInputProps()} aria-label="Upload file" />

          {selectedFile ? (
            <div className="flex w-full max-w-[450px] flex-col items-center px-8">
              {/* Show the file info */}
              <UploadIcon
                className="@min-[500px]:h-20 @min-[500px]:w-20 h-14 w-14"
                animate={selectedFile.status === 'UPLOADING'}
                complete={selectedFile.status === 'COMPLETE'}
              />
              <div className="w-full text-center">
                <div className="truncate font-medium">
                  {selectedFile.file.name}
                </div>

                {selectedFile.status === 'UPLOADING' && (
                  <div className="@min-[500px]:mt-4 mt-2 w-full">
                    <div className="rounded-xs h-4 w-full overflow-hidden border border-violet-800/50">
                      <div
                        className="rounded-xs h-full border border-violet-300/80 bg-violet-400 transition-all duration-300"
                        style={{ width: `${selectedFile.progress}%` }}
                      />
                    </div>
                    <div className="@min-[500px]:mt-4 mt-1 text-center font-mono text-sm font-bold text-violet-300">
                      {Math.round(selectedFile.progress)}%
                    </div>
                  </div>
                )}

                {selectedFile.status === 'COMPLETE' && (
                  <>
                    <a
                      href={selectedFile.url}
                      target="_blank"
                      className="@min-[500px]:mt-4 mt-2 block w-full truncate text-sm underline"
                      rel="noreferrer"
                    >
                      {selectedFile.url}
                    </a>
                    <div className="w-full truncate text-sm opacity-50">
                      (will auto-delete in 1 day)
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <UploadIcon className="@min-[500px]:h-20 @min-[500px]:w-20 h-14 w-14" />
              <div className="@min-[500px]:mt-4 @min-[500px]:text-2xl text-center text-xl font-bold">
                Drag & drop a file here
              </div>
              <div className="@min-[500px]:mt-2 text-center text-sm text-violet-300">
                or click to select
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
