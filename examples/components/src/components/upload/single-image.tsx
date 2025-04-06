'use client';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@edgestore/react/utils';
import {
  AlertCircleIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { ProgressCircle } from './progress-circle';
import { useUploader } from './uploader-provider';

const DROPZONE_VARIANTS = {
  base: 'relative rounded-md p-4 flex justify-center items-center flex-col cursor-pointer min-h-[150px] min-w-[200px] border-2 border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  image:
    'border-0 p-0 min-h-0 min-w-0 relative bg-slate-200 dark:bg-slate-900 shadow-md',
  active: 'border-blue-500',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700 dark:border-gray-600',
  accept: 'border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border-red-700 bg-red-700 bg-opacity-10',
};

export interface SingleImageDropzoneProps
  extends React.HTMLAttributes<HTMLInputElement> {
  width: number;
  height: number;
  disabled?: boolean;
  dropzoneOptions?: Omit<
    DropzoneOptions,
    'disabled' | 'onDrop' | 'maxFiles' | 'multiple'
  >;
}

const SingleImageDropzone = React.forwardRef<
  HTMLInputElement,
  SingleImageDropzoneProps
>(({ dropzoneOptions, width, height, className, disabled, ...props }, ref) => {
  const { fileStates, addFiles, removeFile, cancelUpload } = useUploader();
  const [error, setError] = React.useState<string>();

  const fileState = React.useMemo(() => fileStates[0], [fileStates]);
  const maxSize = dropzoneOptions?.maxSize;

  // Create temporary URL for image preview before upload is complete
  const tempUrl = React.useMemo(() => {
    if (
      fileState?.file &&
      !(fileState.status === 'COMPLETE' && fileState.url)
    ) {
      return URL.createObjectURL(fileState.file);
    }
    return null;
  }, [fileState]);

  // Clean up temporary URL to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (tempUrl) {
        URL.revokeObjectURL(tempUrl);
      }
    };
  }, [tempUrl]);

  const displayUrl = fileState?.url ?? tempUrl;
  const isDisabled =
    !!disabled ||
    fileState?.status === 'UPLOADING' ||
    fileState?.status === 'COMPLETE'; // Disable when upload complete

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: { 'image/*': [] }, // Accept only image files
      multiple: false,
      disabled: isDisabled,
      onDropAccepted: (acceptedFiles) => {
        setError(undefined);
        // Remove existing file before adding a new one
        if (fileStates.length > 0) {
          removeFile(fileStates[0].key);
        }
        addFiles(acceptedFiles);
      },
      onDropRejected: (rejections) => {
        setError(undefined);
        if (rejections[0]?.errors[0]) {
          const error = rejections[0].errors[0];
          const code = error.code;

          // User-friendly error messages
          const messages: Record<string, string> = {
            'file-too-large': `The file is too large. Max size is ${formatFileSize(
              maxSize ?? 0,
            )}.`,
            'file-invalid-type': 'Invalid file type.',
            'too-many-files': 'You can only upload one file.',
            default: 'The file is not supported.',
          };

          setError(messages[code] ?? messages.default);
        }
      },
      ...dropzoneOptions,
    });

  const dropZoneClassName = React.useMemo(
    () =>
      cn(
        DROPZONE_VARIANTS.base,
        isFocused && DROPZONE_VARIANTS.active,
        isDisabled && DROPZONE_VARIANTS.disabled,
        displayUrl && DROPZONE_VARIANTS.image,
        isDragReject && DROPZONE_VARIANTS.reject,
        isDragAccept && DROPZONE_VARIANTS.accept,
        className,
      ),
    [isFocused, isDisabled, displayUrl, isDragAccept, isDragReject, className],
  );

  // Combined error message from dropzone or file state
  const errorMessage = error ?? fileState?.error;

  return (
    <div className="flex flex-col items-center">
      <div
        {...getRootProps({
          className: dropZoneClassName,
          style: {
            width,
            height,
          },
        })}
      >
        <input ref={ref} {...getInputProps()} {...props} />

        {displayUrl ? (
          <img
            className="h-full w-full rounded-md object-cover"
            src={displayUrl}
            alt={fileState?.file.name ?? 'uploaded image'}
          />
        ) : (
          // Placeholder content shown when no image is selected
          <div className="flex flex-col items-center justify-center gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
            <UploadCloudIcon className="mb-1 h-7 w-7 text-gray-400" />
            <div className="font-medium text-gray-600 dark:text-gray-300">
              drag & drop an image or click to select
            </div>
            {maxSize && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Max size: {formatFileSize(maxSize)}
              </div>
            )}
          </div>
        )}

        {/* Upload progress overlay */}
        {displayUrl && fileState?.status === 'UPLOADING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-black bg-opacity-70">
            <ProgressCircle progress={fileState.progress} />
          </div>
        )}

        {/* Remove/Cancel button */}
        {displayUrl &&
          !disabled &&
          fileState &&
          fileState.status !== 'COMPLETE' && (
            <button
              type="button"
              className="border-muted-foreground bg-background group pointer-events-auto absolute right-1 top-1 z-10 transform rounded-full border p-1 shadow-md transition-all hover:scale-110"
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering dropzone click
                if (fileState.status === 'UPLOADING') {
                  cancelUpload(fileState.key);
                } else {
                  removeFile(fileState.key);
                  setError(undefined); // Clear any error when removing the file
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

      {/* Error message display */}
      {errorMessage && (
        <div className="mt-2 flex items-center text-xs text-red-500 dark:text-red-400">
          <AlertCircleIcon className="mr-1 h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
});
SingleImageDropzone.displayName = 'SingleImageDropzone';

export { SingleImageDropzone };
