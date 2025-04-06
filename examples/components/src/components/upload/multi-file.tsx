'use client';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@edgestore/react/utils';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { type DropzoneOptions } from 'react-dropzone';
import { Dropzone } from './dropzone';
import { ProgressBar } from './progress-bar';
import { useUploader } from './uploader-provider';

// File List Component
export interface FileListProps extends React.HTMLAttributes<HTMLDivElement> {}

const FileList = React.forwardRef<HTMLDivElement, FileListProps>(
  ({ className, ...props }, ref) => {
    const { fileStates, removeFile, cancelUpload } = useUploader();

    if (!fileStates.length) return null;

    return (
      <div
        ref={ref}
        className={cn('mt-3 flex w-full flex-col gap-2', className)}
        {...props}
      >
        {fileStates.map(({ file, abortController, progress, status, key }) => {
          return (
            <div
              key={key}
              className="flex flex-col justify-center rounded border border-gray-300 px-4 py-3 shadow-sm dark:border-gray-700"
            >
              <div className="flex items-center gap-3 text-gray-700 dark:text-gray-200">
                <FileIcon className="h-8 w-8 shrink-0 text-gray-500 dark:text-gray-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="truncate text-sm">
                      <div className="overflow-hidden overflow-ellipsis whitespace-nowrap font-medium">
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)}
                      </div>
                    </div>

                    <div className="ml-2 flex items-center gap-2">
                      {status === 'ERROR' && (
                        <div className="flex items-center text-xs text-red-500 dark:text-red-400">
                          <AlertCircleIcon className="mr-1 h-4 w-4" />
                        </div>
                      )}

                      {status === 'UPLOADING' && (
                        <div className="flex flex-col items-end">
                          {abortController && (
                            <button
                              type="button"
                              className="rounded-md p-0.5 transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              disabled={progress === 100}
                              onClick={() => {
                                cancelUpload(key);
                              }}
                            >
                              <XIcon className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-400" />
                            </button>
                          )}
                          <div>{Math.round(progress)}%</div>
                        </div>
                      )}

                      {status !== 'UPLOADING' && status !== 'COMPLETE' && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-700"
                          onClick={() => {
                            removeFile(key);
                          }}
                          title="Remove"
                        >
                          <Trash2Icon className="h-4 w-4 shrink-0" />
                        </button>
                      )}

                      {status === 'COMPLETE' && (
                        <CheckCircleIcon className="h-5 w-5 shrink-0 text-green-500" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              {status === 'UPLOADING' && <ProgressBar progress={progress} />}
            </div>
          );
        })}
      </div>
    );
  },
);
FileList.displayName = 'FileList';

// Complete File Uploader Component
export interface FileUploaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  maxFiles?: number;
  maxSize?: number;
  accept?: DropzoneOptions['accept'];
  disabled?: boolean;
  dropzoneClassName?: string;
  fileListClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

const FileUploader = React.forwardRef<HTMLDivElement, FileUploaderProps>(
  (
    {
      maxFiles,
      maxSize,
      accept,
      disabled,
      className,
      dropzoneClassName,
      fileListClassName,
      inputRef,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('w-full space-y-4', className)} {...props}>
        <Dropzone
          ref={inputRef}
          dropzoneOptions={{
            maxFiles,
            maxSize,
            accept,
          }}
          disabled={disabled}
          className={dropzoneClassName}
        />

        <FileList className={fileListClassName} />
      </div>
    );
  },
);
FileUploader.displayName = 'FileUploader';

export { FileList, FileUploader };
