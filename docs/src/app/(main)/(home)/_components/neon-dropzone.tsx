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
    <div className="relative flex w-full justify-center">
      <div
        {...getRootProps()}
        data-error={hasError}
        className={cn(
          'group @container relative h-full w-full max-w-[600px] transition-all duration-300 select-none',
          isDragActive && 'scale-105',
        )}
      >
        {/* Window dots container - completely separate from the main container */}
        <div className="absolute z-10 m-[3px] flex gap-3 p-4">
          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-red-200 to-red-400 shadow-[0_0_12px_rgba(248,113,113,0.9)]" />
          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-orange-200 to-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
          <div className="h-4 w-4 rounded-full bg-gradient-to-r from-cyan-200 to-cyan-400 shadow-[0_0_12px_rgba(45,212,191,0.9)]" />
        </div>

        {/* Main container with drop shadow */}
        <div
          className={cn(
            'flex h-full w-full flex-col rounded-2xl border-3 border-primary text-primary-500 shadow-[0_0_5px_rgba(75,44,231,.6),0_0_15px_rgba(75,44,231,.2)] transition-all duration-300',
            'dark:border-primary-200 dark:text-primary-200 dark:shadow-[0_0_5px_rgba(170,153,255,1),0_0_15px_rgba(170,153,255,.5)]',
            'group-data-[error=true]:border-red-500 group-data-[error=true]:text-red-500 group-data-[error=true]:shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
            'dark:group-data-[error=true]:border-red-300 dark:group-data-[error=true]:text-red-300 dark:group-data-[error=true]:shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
          )}
        >
          <div className="h-12" /> {/* Spacer for dots */}
          <div
            className={cn(
              'ml-[-1px] h-[3px] w-[calc(100%+2px)] bg-primary transition-all duration-300',
              'dark:bg-primary-200 dark:shadow-[0_0_5px_rgba(170,153,255,1),0_0_15px_rgba(170,153,255,.5)]',
              'group-data-[error=true]:bg-red-500 group-data-[error=true]:shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
              'dark:group-data-[error=true]:bg-red-300 dark:group-data-[error=true]:shadow-[0_0_5px_rgba(248,113,113,1),0_0_15px_rgba(248,113,113,.5)]',
            )}
          />
          {/* Dropzone */}
          <div
            className={cn(
              'm-6 flex h-[160px] grow flex-col items-center justify-center rounded-xl border-3 border-dashed border-primary transition-all duration-300 @min-[500px]:h-[190px] dark:border-primary-200/80',
              'group-data-[error=true]:border-red-500 group-data-[error=true]:text-red-500',
              'dark:group-data-[error=true]:border-red-300 dark:group-data-[error=true]:text-red-300',
            )}
          >
            <input {...getInputProps()} aria-label="Upload file" />

            {selectedFile ? (
              <div className="flex w-full max-w-[450px] flex-col items-center px-8">
                {/* Show the file info */}
                <UploadIcon
                  className="h-14 w-14 @min-[500px]:h-20 @min-[500px]:w-20"
                  animate={selectedFile.status === 'UPLOADING'}
                  complete={selectedFile.status === 'COMPLETE'}
                />
                <div className="w-full text-center">
                  <div className="truncate font-medium">
                    {selectedFile.file.name}
                  </div>

                  {selectedFile.status === 'UPLOADING' && (
                    <div className="mt-2 w-full @min-[500px]:mt-4">
                      <div className="h-4 w-full overflow-hidden rounded-xs border border-primary-800/50">
                        <div
                          className="h-full rounded-xs border border-primary-400/80 bg-primary transition-all duration-300 dark:border-primary-300/80 dark:bg-primary-400"
                          style={{ width: `${selectedFile.progress}%` }}
                        />
                      </div>
                      <div className="mt-1 text-center font-mono text-sm font-bold text-primary-400 @min-[500px]:mt-4 dark:text-primary-300">
                        {Math.round(selectedFile.progress)}%
                      </div>
                    </div>
                  )}

                  {selectedFile.status === 'COMPLETE' && (
                    <>
                      <a
                        href={selectedFile.url}
                        target="_blank"
                        className="block w-full truncate text-sm underline"
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
                <UploadIcon className="h-14 w-14 @min-[500px]:h-20 @min-[500px]:w-20" />
                <div className="text-center text-xl font-bold @min-[500px]:mt-4 @min-[500px]:text-2xl">
                  Drag & drop a file here
                </div>
                <div className="text-center text-sm opacity-80 @min-[500px]:mt-2">
                  or click to select
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Error Text */}
      {error && (
        <div className="absolute top-[calc(100%+5px)] right-0 left-0 flex items-center justify-center text-sm text-red-500 dark:text-red-300">
          <AlertCircleIcon className="mr-2 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
