'use client';

import { cn } from '@/lib/utils';
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
import { formatFileSize, useUploader } from './uploader-provider';

/**
 * Displays a list of files with their upload status, progress, and controls.
 *
 * @component
 * @example
 * ```tsx
 * <FileList className="my-4" />
 * ```
 */
const FileList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
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
            className="shadow-xs flex flex-col justify-center rounded border border-border px-4 py-3"
          >
            <div className="flex items-center gap-3 text-foreground">
              <FileIcon className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="truncate text-sm">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap font-medium">
                      {file.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </div>
                  </div>

                  <div className="ml-2 flex items-center gap-2">
                    {status === 'ERROR' && (
                      <div className="flex items-center text-xs text-destructive">
                        <AlertCircleIcon className="mr-1 h-4 w-4" />
                      </div>
                    )}

                    {status === 'UPLOADING' && (
                      <div className="flex flex-col items-end">
                        {abortController && (
                          <button
                            type="button"
                            className="rounded-md p-0.5 transition-colors duration-200 hover:bg-secondary"
                            disabled={progress === 100}
                            onClick={() => {
                              cancelUpload(key);
                            }}
                          >
                            <XIcon className="block h-4 w-4 shrink-0 text-muted-foreground" />
                          </button>
                        )}
                        <div>{Math.round(progress)}%</div>
                      </div>
                    )}

                    {status !== 'UPLOADING' && status !== 'COMPLETE' && (
                      <button
                        type="button"
                        className="rounded-md p-1 text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-destructive"
                        onClick={() => {
                          removeFile(key);
                        }}
                        title="Remove"
                      >
                        <Trash2Icon className="block h-4 w-4 shrink-0" />
                      </button>
                    )}

                    {status === 'COMPLETE' && (
                      <CheckCircleIcon className="h-5 w-5 shrink-0 text-primary" />
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
});
FileList.displayName = 'FileList';

/**
 * Props for the FileUploader component.
 *
 * @interface FileUploaderProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface FileUploaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of files allowed.
   */
  maxFiles?: number;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Accepted file types.
   *
   * @example
   * ```tsx
   * accept={{ 'image/*': ['.png', '.jpg', '.jpeg'] }}
   * ```
   */
  accept?: DropzoneOptions['accept'];

  /**
   * Whether the uploader is disabled.
   */
  disabled?: boolean;

  /**
   * Additional className for the dropzone component.
   */
  dropzoneClassName?: string;

  /**
   * Additional className for the file list component.
   */
  fileListClassName?: string;

  /**
   * Ref for the input element inside the Dropzone.
   */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * A complete file uploader component with dropzone and file list.
 *
 * @component
 * @example
 * ```tsx
 * <FileUploader
 *   maxFiles={5}
 *   maxSize={1024 * 1024 * 10} // 10MB
 *   accept={{ 'application/pdf': [] }}
 * />
 * ```
 */
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
