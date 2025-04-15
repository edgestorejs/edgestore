'use client';

import { cn } from '@/lib/utils';
import { Trash2Icon, XIcon } from 'lucide-react';
import * as React from 'react';
import { type DropzoneOptions } from 'react-dropzone';
import { Dropzone } from './dropzone';
import { ProgressCircle } from './progress-circle';
import { useUploader } from './uploader-provider';

/**
 * Props for the ImageList component.
 *
 * @interface ImageListProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface ImageListProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether the image deletion controls should be disabled.
   */
  disabled?: boolean;
}

/**
 * Displays a grid of image previews with upload status and controls.
 *
 * @component
 * @example
 * ```tsx
 * <ImageList className="my-4" />
 * ```
 */
const ImageList = React.forwardRef<HTMLDivElement, ImageListProps>(
  ({ className, disabled: initialDisabled, ...props }, ref) => {
    const { fileStates, removeFile, cancelUpload } = useUploader();

    // Create temporary URLs for image previews
    const tempUrls = React.useMemo(() => {
      const urls: Record<string, string> = {};
      fileStates.forEach((fileState) => {
        if (fileState.file) {
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
    }, [tempUrls]);

    if (!fileStates.length) return null;

    return (
      <div
        ref={ref}
        className={cn('mt-4 grid grid-cols-3 gap-2', className)}
        {...props}
      >
        {fileStates.map((fileState) => {
          const displayUrl = tempUrls[fileState.key] ?? fileState.url;
          return (
            <div
              key={fileState.key}
              className={
                'relative aspect-square h-full w-full rounded-md border-0 bg-muted p-0 shadow-md'
              }
            >
              {displayUrl ? (
                <img
                  className="h-full w-full rounded-md object-cover"
                  src={displayUrl}
                  alt={fileState.file.name}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-secondary">
                  <span className="text-xs text-muted-foreground">
                    No Preview
                  </span>
                </div>
              )}

              {/* Upload progress indicator */}
              {fileState.status === 'UPLOADING' && (
                <div className="absolute left-0 top-0 flex h-full w-full items-center justify-center rounded-md bg-black/70">
                  <ProgressCircle progress={fileState.progress} />
                </div>
              )}

              {/* Delete/cancel button */}
              {displayUrl && !initialDisabled && (
                <button
                  type="button"
                  className="group pointer-events-auto absolute right-1 top-1 z-10 -translate-y-1/4 translate-x-1/4 transform rounded-full border border-muted-foreground bg-background p-1 shadow-md transition-all hover:scale-110"
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
                    <XIcon className="block h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Trash2Icon className="block h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);
ImageList.displayName = 'ImageList';

/**
 * Props for the ImageDropzone component.
 *
 * @interface ImageDropzoneProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface ImageDropzoneProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether the dropzone is disabled.
   */
  disabled?: boolean;

  /**
   * Options passed to the underlying Dropzone component.
   * Cannot include 'disabled' or 'onDrop' as they are handled internally.
   */
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled' | 'onDrop'>;

  /**
   * Ref for the input element inside the Dropzone.
   */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * A dropzone component specifically for image uploads.
 *
 * @component
 * @example
 * ```tsx
 * <ImageDropzone
 *   dropzoneOptions={{
 *     maxFiles: 5,
 *     maxSize: 1024 * 1024 * 2, // 2MB
 *   }}
 * />
 * ```
 */
const ImageDropzone = React.forwardRef<HTMLDivElement, ImageDropzoneProps>(
  ({ dropzoneOptions, className, disabled, inputRef, ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        <Dropzone
          ref={inputRef}
          dropzoneOptions={{
            accept: { 'image/*': [] },
            ...dropzoneOptions,
          }}
          disabled={disabled}
          dropMessageActive="Drop images here..."
          dropMessageDefault="drag & drop images here, or click to select"
        />
      </div>
    );
  },
);
ImageDropzone.displayName = 'ImageDropzone';

/**
 * Props for the ImageUploader component.
 *
 * @interface ImageUploaderProps
 * @extends {React.HTMLAttributes<HTMLDivElement>}
 */
export interface ImageUploaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum number of images allowed.
   */
  maxFiles?: number;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Whether the uploader is disabled.
   */
  disabled?: boolean;

  /**
   * Additional className for the dropzone component.
   */
  dropzoneClassName?: string;

  /**
   * Additional className for the image list component.
   */
  imageListClassName?: string;

  /**
   * Ref for the input element inside the Dropzone.
   */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * A complete image uploader component with dropzone and image grid preview.
 *
 * @component
 * @example
 * ```tsx
 * <ImageUploader
 *   maxFiles={10}
 *   maxSize={1024 * 1024 * 5} // 5MB
 * />
 * ```
 */
const ImageUploader = React.forwardRef<HTMLDivElement, ImageUploaderProps>(
  (
    {
      maxFiles,
      maxSize,
      disabled,
      className,
      dropzoneClassName,
      imageListClassName,
      inputRef,
      ...props
    },
    ref,
  ) => {
    return (
      <div ref={ref} className={cn('w-full space-y-4', className)} {...props}>
        <ImageDropzone
          ref={inputRef}
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
  },
);
ImageUploader.displayName = 'ImageUploader';

export { ImageList, ImageDropzone, ImageUploader };
