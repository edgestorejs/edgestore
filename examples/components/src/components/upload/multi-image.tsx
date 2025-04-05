'use client';

import { formatFileSize } from '@edgestore/react/utils';
import {
  AlertCircleIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { twMerge } from 'tailwind-merge';
import { ProgressCircle } from './progress-circle';
import { useUploader } from './uploader-provider';

const DROPZONE_VARIANTS = {
  base: 'relative rounded-md p-4 w-full flex justify-center items-center flex-col cursor-pointer border-2 border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  active: 'border-blue-500',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700 dark:border-gray-600',
  accept: 'border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border-red-700 bg-red-700 bg-opacity-10',
};

type InputProps = {
  className?: string;
  disabled?: boolean;
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled' | 'onDrop'>;
};

const MultiImageDropzone = React.forwardRef<HTMLInputElement, InputProps>(
  ({ dropzoneOptions, className, disabled }, ref) => {
    const { fileStates, addFiles } = useUploader();
    const [error, setError] = React.useState<string>();

    const maxFiles = dropzoneOptions?.maxFiles;
    const maxSize = dropzoneOptions?.maxSize;

    // Disable if explicitly disabled or max files reached
    const isDisabled =
      !!disabled || (maxFiles !== undefined && fileStates.length >= maxFiles);

    const {
      getRootProps,
      getInputProps,
      isFocused,
      isDragAccept,
      isDragReject,
    } = useDropzone({
      accept: { 'image/*': [] },
      disabled: isDisabled,
      onDropAccepted: (acceptedFiles) => {
        setError(undefined);
        const currentFilesCount = fileStates.length;

        // Limit files to remaining capacity
        const filesToAdd = acceptedFiles.slice(
          0,
          maxFiles ? maxFiles - currentFilesCount : undefined,
        );
        addFiles(filesToAdd);
      },
      onDropRejected: (rejections) => {
        setError(undefined);
        if (rejections[0]?.errors[0]) {
          const error = rejections[0].errors[0];
          const code = error.code;
          const messages: Record<string, string> = {
            'file-too-large': `The file is too large. Max size is ${formatFileSize(
              maxSize ?? 0,
            )}.`,
            'file-invalid-type': 'Invalid file type.',
            'too-many-files': `You can only add ${
              maxFiles ?? 'multiple'
            } file(s).`,
            default: 'The file is not supported.',
          };
          setError(messages[code] ?? messages.default);
        }
      },
      ...dropzoneOptions,
    });

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
      [isFocused, isDisabled, isDragReject, isDragAccept, className],
    );

    // Display first error found in any file state
    const errorMessage = React.useMemo(() => {
      if (error) return error;
      for (const fileState of fileStates) {
        if (fileState.error) return fileState.error;
      }
      return undefined;
    }, [error, fileStates]);

    return (
      <div className="w-full">
        {/* Drop zone area */}
        <div
          {...getRootProps({
            className: dropZoneClassName,
          })}
        >
          <input ref={ref} {...getInputProps()} />
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <UploadCloudIcon className="h-10 w-10 text-gray-400" />
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isDragAccept
                ? 'Drop images here...'
                : 'drag & drop images here, or click to select'}
            </div>
            {maxSize && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {maxFiles && maxFiles > 1 ? `Up to ${maxFiles} images, ` : ''}
                Max size: {formatFileSize(maxSize)}
              </div>
            )}
          </div>
        </div>

        {/* Error message display */}
        {errorMessage && (
          <div className="mt-1 flex items-center text-xs text-red-500">
            <AlertCircleIcon className="mr-1 h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    );
  },
);
MultiImageDropzone.displayName = 'MultiImageDropzone';

// Displays a grid of uploaded images with status indicators and removal buttons
export const ImageList: React.FC<{
  className?: string;
  disabled?: boolean;
}> = ({ className, disabled: initialDisabled }) => {
  const { fileStates, removeFile, cancelUpload } = useUploader();

  // Create temporary URLs for image previews
  const tempUrls = React.useMemo(() => {
    const urls: Record<string, string> = {};
    fileStates.forEach((fileState) => {
      if (
        fileState.file &&
        !(fileState.status === 'COMPLETE' && fileState.url)
      ) {
        urls[fileState.key] = URL.createObjectURL(fileState.file);
      }
    });
    return urls;
  }, [fileStates]);

  // Clean up temporary URLs on unmount
  React.useEffect(() => {
    return () => {
      Object.values(tempUrls).forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tempUrls]);

  if (!fileStates.length) return null;

  return (
    <div className={twMerge('mt-4 grid grid-cols-3 gap-2', className)}>
      {fileStates.map((fileState) => {
        const displayUrl = fileState.url ?? tempUrls[fileState.key];
        return (
          <div
            key={fileState.key}
            className={
              'relative aspect-square h-full w-full rounded-md border-0 bg-slate-200 p-0 shadow-md dark:bg-slate-900'
            }
          >
            {displayUrl ? (
              <img
                className="h-full w-full rounded-md object-cover"
                src={displayUrl}
                alt={fileState.file.name}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-200 dark:bg-gray-800">
                <span className="text-xs text-gray-500">No Preview</span>
              </div>
            )}

            {/* Upload progress indicator */}
            {fileState.status === 'UPLOADING' && (
              <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center rounded-md bg-black bg-opacity-70">
                <ProgressCircle progress={fileState.progress} />
              </div>
            )}

            {/* Delete/cancel button */}
            {displayUrl && !initialDisabled && (
              <button
                type="button"
                className="border-muted-foreground bg-background group pointer-events-auto absolute right-1 top-1 z-10 -translate-y-1/4 translate-x-1/4 transform rounded-full border p-1 shadow-md transition-all hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  if (fileState.status === 'UPLOADING') {
                    cancelUpload(fileState.key);
                  } else {
                    removeFile(fileState.key);
                  }
                }}
              >
                {fileState.status === 'UPLOADING' ? (
                  <XIcon className="text-muted-foreground h-4 w-4" />
                ) : (
                  <Trash2Icon className="text-muted-foreground h-4 w-4" />
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Complete component that combines dropzone and image list
export const ImageUploader: React.FC<{
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
  dropzoneClassName?: string;
  imageListClassName?: string;
}> = ({
  maxFiles,
  maxSize,
  disabled,
  className,
  dropzoneClassName,
  imageListClassName,
}) => {
  return (
    <div className={twMerge('w-full space-y-4', className)}>
      <MultiImageDropzone
        dropzoneOptions={{
          maxFiles,
          maxSize,
        }}
        disabled={disabled}
        className={dropzoneClassName}
      />

      <ImageList className={imageListClassName} disabled={disabled} />
    </div>
  );
};

export { MultiImageDropzone };
