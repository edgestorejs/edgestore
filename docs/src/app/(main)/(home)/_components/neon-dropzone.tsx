'use client';

import { useUploader } from '@/components/upload/uploader-provider';
import { cn } from '@/lib/utils';
import { AlertCircleIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import UploadIcon from './upload-icon';

export function NeonDropzone() {
  const { addFiles, fileStates } = useUploader();
  const [error, setError] = useState<string>();

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(undefined);

      // Handle rejections first
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection?.errors[0]) {
          const error = rejection.errors[0];
          const code = error.code;
          const messages: Record<string, string> = {
            'file-too-large': 'The file is too large. Max size is 1MB.',
            'file-invalid-type': 'Invalid file type.',
            'too-many-files': 'You can only add 1 file.',
            default: 'The file is not supported.',
          };
          setError(messages[code] ?? messages.default);
        }
        return; // Exit early if there are any rejections
      }

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0]!;
        addFiles([file]);
      }
    },
    [addFiles],
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      maxFiles: 1,
      maxSize: 1024 * 1024 * 1, // 1MB
      multiple: false,
      disabled: fileStates.length > 0,
    });

  const selectedFile = fileStates[0];
  const hasError = !!error || isDragReject;

  return (
    <div className="relative w-full">
      <div
        {...getRootProps()}
        data-error={hasError}
        className={cn(
          '@container group relative h-full w-full max-w-[600px] select-none place-self-center transition-all duration-300',
          isDragActive && 'scale-105',
        )}
      >
        {/* Window dots container - completely separate from the main container */}
        <div className="absolute z-10 m-[3px] flex gap-3 p-4">
          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-red-200 to-red-400 sm:drop-shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-orange-200 to-orange-400 sm:drop-shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-cyan-200 to-cyan-400 sm:drop-shadow-[0_0_12px_rgba(45,212,191,0.9)]" />
        </div>

        {/* Main container with drop shadow */}
        <div
          className={cn(
            'border-3 border-primary text-primary-500 flex h-full w-full flex-col rounded-2xl sm:drop-shadow-[0_0_5px_rgba(75,44,231,.6),0_0_15px_rgba(75,44,231,.2)]',
            'dark:border-primary-200 dark:text-primary-200 dark:sm:drop-shadow-[0_0_5px_rgba(170,153,255,1),0_0_15px_rgba(170,153,255,.5)]',
            'group-data-[error=true]:border-red-500 group-data-[error=true]:text-red-500 group-data-[error=true]:sm:drop-shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
            'dark:group-data-[error=true]:border-red-300 dark:group-data-[error=true]:text-red-300 dark:group-data-[error=true]:sm:drop-shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
          )}
        >
          <div className="h-12" /> {/* Spacer for dots */}
          <div
            className={cn(
              'dark:bg-primary-200 bg-primary ml-[-1px] h-[3px] w-[calc(100%+2px)]',
              'group-data-[error=true]:bg-red-500 dark:group-data-[error=true]:bg-red-300',
            )}
          />
          {/* Dropzone */}
          <div
            className={cn(
              'border-3 @min-[500px]:h-[190px] dark:border-primary-200/80 border-primary m-6 flex h-[160px] grow flex-col items-center justify-center rounded-xl border-dashed transition-all duration-300',
              isDragActive &&
                'sm:drop-shadow-[0_0_15px_rgba(225,42,251,.3)] group-data-[error=true]:sm:drop-shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
              'group-data-[error=true]:border-red-500 group-data-[error=true]:text-red-500',
              'dark:group-data-[error=true]:border-red-300 dark:group-data-[error=true]:text-red-300',
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
                      <div className="rounded-xs border-primary-800/50 h-4 w-full overflow-hidden border">
                        <div
                          className="rounded-xs dark:border-primary-300/80 border-primary-400/80 dark:bg-primary-400 bg-primary h-full border transition-all duration-300"
                          style={{ width: `${selectedFile.progress}%` }}
                        />
                      </div>
                      <div className="@min-[500px]:mt-4 dark:text-primary-300 text-primary-400 mt-1 text-center font-mono text-sm font-bold">
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
                <div className="@min-[500px]:mt-2 text-center text-sm opacity-80">
                  or click to select
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Text */}
      {error && (
        <div className="absolute left-0 right-0 top-[calc(100%+5px)] flex items-center justify-center text-sm text-red-500 sm:drop-shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)] dark:text-red-300">
          <AlertCircleIcon className="mr-2 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
