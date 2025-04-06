'use client';

import { cn } from '@/lib/utils';
import { Trash2Icon, XIcon } from 'lucide-react';
import * as React from 'react';
import { type DropzoneOptions } from 'react-dropzone';
import { Dropzone } from './dropzone';
import { ProgressCircle } from './progress-circle';
import { useUploader } from './uploader-provider';

export interface ImageListProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
}

const ImageList = React.forwardRef<HTMLDivElement, ImageListProps>(
  ({ className, disabled: initialDisabled, ...props }, ref) => {
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
      <div
        ref={ref}
        className={cn('mt-4 grid grid-cols-3 gap-2', className)}
        {...props}
      >
        {fileStates.map((fileState) => {
          const displayUrl = fileState.url ?? tempUrls[fileState.key];
          return (
            <div
              key={fileState.key}
              className={
                'bg-muted relative aspect-square h-full w-full rounded-md border-0 p-0 shadow-md'
              }
            >
              {displayUrl ? (
                <img
                  className="h-full w-full rounded-md object-cover"
                  src={displayUrl}
                  alt={fileState.file.name}
                />
              ) : (
                <div className="bg-secondary flex h-full w-full items-center justify-center">
                  <span className="text-muted-foreground text-xs">
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
  },
);
ImageList.displayName = 'ImageList';

export interface ImageDropzoneProps
  extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled' | 'onDrop'>;
  inputRef?: React.Ref<HTMLInputElement>;
}

const ImageDropzone = React.forwardRef<HTMLDivElement, ImageDropzoneProps>(
  ({ dropzoneOptions, className, disabled, inputRef, ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        <Dropzone
          ref={inputRef}
          dropzoneOptions={{
            ...dropzoneOptions,
            accept: { 'image/*': [] },
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

export interface ImageUploaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  dropzoneClassName?: string;
  imageListClassName?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

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
