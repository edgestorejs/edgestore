'use client';

import { cn } from '@/lib/utils';
import {
  AlertCircleIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { ProgressCircle } from './progress-circle';
import { formatFileSize, useUploader } from './uploader-provider';

const DROPZONE_VARIANTS = {
  base: 'relative rounded-md p-4 flex justify-center items-center flex-col cursor-pointer min-h-[150px] min-w-[200px] border-2 border-dashed border-muted-foreground transition-colors duration-200 ease-in-out',
  image: 'border-0 p-0 min-h-0 min-w-0 relative bg-muted shadow-md',
  active: 'border-primary',
  disabled:
    'bg-muted/50 border-muted-foreground/50 cursor-default pointer-events-none',
  accept: 'border-primary bg-primary/10',
  reject: 'border-destructive bg-destructive/10',
};

/**
 * Props for the SingleImageDropzone component.
 *
 * @interface SingleImageDropzoneProps
 * @extends {React.HTMLAttributes<HTMLInputElement>}
 */
export interface SingleImageDropzoneProps
  extends React.HTMLAttributes<HTMLInputElement> {
  /**
   * The width of the dropzone area in pixels.
   */
  width: number;

  /**
   * The height of the dropzone area in pixels.
   */
  height: number;

  /**
   * Whether the dropzone is disabled.
   */
  disabled?: boolean;

  /**
   * Options passed to the underlying react-dropzone component.
   * Cannot include 'disabled', 'onDrop', 'maxFiles', or 'multiple' as they are handled internally.
   */
  dropzoneOptions?: Omit<
    DropzoneOptions,
    'disabled' | 'onDrop' | 'maxFiles' | 'multiple'
  >;
}

/**
 * A single image upload component with preview and upload status.
 *
 * This component allows users to upload a single image, shows a preview,
 * displays upload progress, and provides controls to remove or cancel the upload.
 *
 * @component
 * @example
 * ```tsx
 * <SingleImageDropzone
 *   width={320}
 *   height={320}
 *   dropzoneOptions={{ maxSize: 1024 * 1024 * 2 }} // 2MB
 * />
 * ```
 */
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
    if (fileState?.file) {
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

  const displayUrl = tempUrl ?? fileState?.url;
  const isDisabled =
    !!disabled ||
    fileState?.status === 'UPLOADING' ||
    fileState?.status === 'COMPLETE'; // Disable when upload complete

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: { 'image/*': [] }, // Accept only image files
      multiple: false,
      disabled: isDisabled,
      onDrop: (acceptedFiles, rejectedFiles) => {
        setError(undefined);

        // Handle rejections first
        if (rejectedFiles.length > 0) {
          if (rejectedFiles[0]?.errors[0]) {
            const error = rejectedFiles[0].errors[0];
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
          return; // Exit early if there are any rejections
        }

        // Handle accepted files only if there are no rejections
        if (acceptedFiles.length > 0) {
          // Remove existing file before adding a new one
          if (fileStates[0]) {
            removeFile(fileStates[0].key);
          }
          addFiles(acceptedFiles);
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
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground',
              isDisabled && 'opacity-50',
            )}
          >
            <UploadCloudIcon className="mb-1 h-7 w-7" />
            <div className="font-medium">
              drag & drop an image or click to select
            </div>
            {maxSize && (
              <div className="text-xs">Max size: {formatFileSize(maxSize)}</div>
            )}
          </div>
        )}

        {/* Upload progress overlay */}
        {displayUrl && fileState?.status === 'UPLOADING' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-black/70">
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
              className="group pointer-events-auto absolute right-1 top-1 z-10 transform rounded-full border border-muted-foreground bg-background p-1 shadow-md transition-all hover:scale-110"
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
                <XIcon className="block h-4 w-4 text-muted-foreground" />
              ) : (
                <Trash2Icon className="block h-4 w-4 text-muted-foreground" />
              )}
            </button>
          )}
      </div>

      {/* Error message display */}
      {errorMessage && (
        <div className="mt-2 flex items-center text-xs text-destructive">
          <AlertCircleIcon className="mr-1 h-4 w-4" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
});
SingleImageDropzone.displayName = 'SingleImageDropzone';

export { SingleImageDropzone };
