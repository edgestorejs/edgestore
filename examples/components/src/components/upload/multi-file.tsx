'use client';

import { formatFileSize } from '@edgestore/react/utils';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  FileIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { twMerge } from 'tailwind-merge';
import { useUploader } from './uploader-provider';

// Constants
const DROPZONE_VARIANTS = {
  base: 'relative rounded-md p-4 w-full flex justify-center items-center flex-col cursor-pointer border-2 border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  active: 'border-2 border-blue-500',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700 dark:border-gray-600',
  accept: 'border-2 border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border-2 border-red-700 bg-red-700 bg-opacity-10',
};

// Dropzone Component
export const Dropzone = React.forwardRef<
  HTMLInputElement,
  {
    className?: string;
    dropzoneOptions?: Omit<
      DropzoneOptions,
      'disabled' | 'onDrop' | 'onDropRejected'
    >;
    disabled?: boolean;
  }
>(({ dropzoneOptions, className, disabled }, ref) => {
  const { fileStates, addFiles } = useUploader();
  const [error, setError] = React.useState<string>();

  const maxFiles = dropzoneOptions?.maxFiles;
  const maxSize = dropzoneOptions?.maxSize;
  const isMaxFilesReached = !!maxFiles && fileStates.length >= maxFiles;
  const isDisabled = disabled ?? isMaxFilesReached;

  // dropzone configuration
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isFocused,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    disabled: isDisabled,
    onDropAccepted: (acceptedFiles) => {
      if (acceptedFiles.length === 0) return;
      setError(undefined);
      addFiles(acceptedFiles);
    },
    onDropRejected: (rejections) => {
      const messages: Record<string, string> = {
        'file-too-large': `The file is too large. Max size is ${formatFileSize(
          maxSize ?? 0,
        )}.`,
        'file-invalid-type': 'Invalid file type.',
        'too-many-files': `You can only add ${maxFiles} file(s).`,
        default: 'The file is not supported.',
      };

      if (rejections.length > 0) {
        const { errors } = rejections[0];
        if (errors.length > 0) {
          const error = errors[0];
          setError(messages[error.code] ?? messages.default);
        }
      }
    },
    ...dropzoneOptions,
  });

  // styling
  const dropZoneClassName = React.useMemo(
    () =>
      twMerge(
        DROPZONE_VARIANTS.base,
        isFocused && DROPZONE_VARIANTS.active,
        isDisabled && DROPZONE_VARIANTS.disabled,
        isDragReject && DROPZONE_VARIANTS.reject,
        isDragAccept && DROPZONE_VARIANTS.accept,
        className,
      ).trim(),
    [isFocused, isDisabled, isDragAccept, isDragReject, className],
  );

  return (
    <div className="w-full">
      <div
        {...getRootProps({
          className: dropZoneClassName,
        })}
      >
        <input ref={ref} {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <UploadCloudIcon className="h-10 w-10 text-gray-400" />
          <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {isDragActive
              ? 'Drop files here...'
              : 'drag & drop files here, or click to select'}
          </div>
          {dropzoneOptions?.maxSize && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {maxFiles && maxFiles > 1 ? `Up to ${maxFiles} files, ` : ''}
              Max size: {formatFileSize(dropzoneOptions.maxSize)}
            </div>
          )}
        </div>
      </div>

      {/* Error Text */}
      {error && (
        <div className="mt-2 flex items-center text-xs text-red-500 dark:text-red-400">
          <AlertCircleIcon className="mr-1 h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});
Dropzone.displayName = 'Dropzone';

// File List Component
export const FileList: React.FC<{
  className?: string;
}> = ({ className }) => {
  const { fileStates, removeFile, cancelUpload } = useUploader();

  if (!fileStates.length) return null;

  return (
    <div className={twMerge('mt-3 flex w-full flex-col gap-2', className)}>
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
            {status === 'UPLOADING' && (
              <div className="relative h-0">
                <div className="absolute top-1 h-1 w-full overflow-clip rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full bg-gray-400 transition-all duration-300 ease-in-out dark:bg-white"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Complete File Uploader Component
export const FileUploader: React.FC<{
  maxFiles?: number;
  maxSize?: number;
  accept?: DropzoneOptions['accept'];
  disabled?: boolean;
  className?: string;
  dropzoneClassName?: string;
  fileListClassName?: string;
}> = ({
  maxFiles,
  maxSize,
  accept,
  disabled,
  className,
  dropzoneClassName,
  fileListClassName,
}) => {
  return (
    <div className={twMerge('w-full space-y-4', className)}>
      <Dropzone
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
};
