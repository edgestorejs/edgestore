'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  CheckIcon,
  ImageIcon,
  PlusIcon,
  RotateCwIcon,
  XIcon,
} from 'lucide-react';
import * as React from 'react';
import { type Accept } from 'react-dropzone';
import {
  DropzoneOverlay,
  DropzonePrompt,
  dropzoneState,
  dropzoneVariants,
  UploadErrors,
  useUploadDropzone,
} from './dropzone';
import { ProgressBar } from './progress-bar';
import {
  describeLimits,
  formatFileSize,
  IMAGE_ACCEPT,
  useObjectUrl,
} from './upload-utils';
import { useUploader, type FileState } from './uploader-provider';

/**
 * One image of the grid with its status and actions.
 */
export function ImageTile({
  fileState,
  disabled,
}: {
  fileState: FileState;
  disabled?: boolean;
}) {
  const { removeFile, cancelUpload, uploadFiles } = useUploader();
  const preview = useObjectUrl(fileState.file);
  const { key, file, status, progress, error } = fileState;
  const src = preview ?? fileState.url;

  return (
    <li
      data-status={status}
      className="group/tile relative aspect-square animate-in overflow-hidden rounded-lg bg-muted fade-in-0 zoom-in-95"
    >
      {src && (
        <img
          src={src}
          alt={file.name}
          className="size-full object-cover transition duration-300 group-hover/tile:scale-[1.03] group-data-[status=ERROR]/tile:brightness-50 group-data-[status=ERROR]/tile:grayscale-[.6] group-data-[status=UPLOADING]/tile:brightness-75 motion-reduce:transition-none"
        />
      )}

      {status === 'COMPLETE' && (
        <span className="absolute top-1.5 left-1.5 grid size-5 animate-in place-items-center rounded-full bg-emerald-600 text-white shadow-sm zoom-in-50 dark:bg-emerald-500">
          <CheckIcon className="size-3" strokeWidth={3} />
          <span className="sr-only">Uploaded</span>
        </span>
      )}

      {(status === 'COMPLETE' || status === 'PENDING') && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between gap-1.5 bg-linear-to-t from-black/65 to-transparent px-2 pt-5 pb-1.5 text-[11px] text-white opacity-0 transition-opacity group-focus-within/tile:opacity-100 group-hover/tile:opacity-100">
          <span className="truncate">{file.name}</span>
          <span className="shrink-0">{formatFileSize(file.size)}</span>
        </div>
      )}

      {status === 'UPLOADING' && (
        <ProgressBar
          progress={progress}
          aria-label={`Uploading ${file.name}`}
          className="absolute inset-x-2 bottom-2 w-auto bg-white/30"
          indicatorClassName="bg-white"
        />
      )}

      {status === 'ERROR' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-xs font-semibold text-white">
          <span title={error}>Upload failed</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => void uploadFiles([key])}
              className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 font-medium backdrop-blur-sm outline-none hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <RotateCwIcon className="size-3.5" /> Retry
            </button>
          )}
        </div>
      )}

      {!disabled && (
        <button
          type="button"
          onClick={() =>
            status === 'UPLOADING' ? cancelUpload(key) : removeFile(key)
          }
          aria-label={
            status === 'UPLOADING'
              ? `Cancel ${file.name}`
              : `Remove ${file.name}`
          }
          className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/60 text-white opacity-0 backdrop-blur-sm transition outline-none group-focus-within/tile:opacity-100 group-hover/tile:opacity-100 group-data-[status=ERROR]/tile:opacity-100 hover:bg-black/80 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/70 [@media(hover:none)]:opacity-100"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </li>
  );
}

/**
 * Props for the ImageUploader component.
 */
export type ImageUploaderProps = React.ComponentProps<'div'> & {
  /**
   * Maximum number of images allowed in total.
   */
  maxFiles?: number;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Accepted image types.
   * @default PNG, JPG, WEBP and GIF
   */
  accept?: Accept;

  /**
   * Human-readable list of accepted types, shown in the hint and messages.
   * @default "PNG, JPG, WEBP or GIF"
   */
  typesLabel?: string;

  /**
   * Whether the uploader is disabled.
   */
  disabled?: boolean;
};

/**
 * A gallery uploader. Empty, it is a large dropzone. With images, it shows a
 * thumbnail grid that still accepts drops, plus an "Add" tile.
 *
 * @example
 * ```tsx
 * <ImageUploader
 *   maxFiles={10}
 *   maxSize={1024 * 1024 * 5} // 5MB
 * />
 * ```
 */
export function ImageUploader({
  maxFiles,
  maxSize,
  accept = IMAGE_ACCEPT,
  typesLabel = 'PNG, JPG, WEBP or GIF',
  disabled,
  className,
  ...props
}: ImageUploaderProps) {
  const { fileStates, resetFiles, isUploading } = useUploader();
  const hasFiles = fileStates.length > 0;

  const {
    getRootProps,
    getInputProps,
    open,
    isDragActive,
    isDragReject,
    errors,
    clearErrors,
    isFull,
  } = useUploadDropzone({
    accept,
    maxSize,
    maxFiles,
    typesLabel,
    disabled,
    // Once there are thumbnails, clicks belong to the tiles; the "Add" tile opens the dialog.
    noClick: hasFiles,
    noKeyboard: hasFiles,
  });

  return (
    <div className={cn('flex w-full flex-col gap-3', className)} {...props}>
      <div
        {...getRootProps({
          role: hasFiles ? 'group' : 'button',
          'aria-label': hasFiles
            ? 'Images. Drop images here to add more.'
            : 'Upload images',
          className: cn(
            dropzoneVariants,
            hasFiles
              ? 'block cursor-default border-solid border-border p-3 hover:border-border hover:bg-muted/40'
              : 'min-h-40',
          ),
        })}
        {...dropzoneState({
          isDragActive,
          isDragReject,
          disabled: !hasFiles && (disabled || isFull),
        })}
      >
        <input {...getInputProps()} />
        {hasFiles ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2.5">
            {fileStates.map((fileState) => (
              <ImageTile
                key={fileState.key}
                fileState={fileState}
                disabled={disabled}
              />
            ))}
            {!isFull && !disabled && (
              <li>
                <button
                  type="button"
                  onClick={open}
                  className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-muted-foreground/30 bg-background text-sm font-medium text-muted-foreground transition-colors outline-none hover:border-primary hover:bg-primary/5 hover:text-primary focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <PlusIcon className="size-5" />
                  Add
                </button>
              </li>
            )}
          </ul>
        ) : (
          <DropzonePrompt
            icon={<ImageIcon />}
            isDragActive={isDragActive}
            isDragReject={isDragReject}
            activeText="Drop images to upload"
            rejectText="Only images are supported"
            title={
              <>
                <span className="font-semibold text-primary">
                  Click to upload
                </span>{' '}
                or drag and drop
              </>
            }
            hint={describeLimits({ typesLabel, maxSize, maxFiles })}
          />
        )}
        {hasFiles && isDragActive && (
          <DropzoneOverlay isDragReject={isDragReject}>
            {isDragReject ? 'Only images are supported' : 'Drop to add images'}
          </DropzoneOverlay>
        )}
      </div>

      {hasFiles && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {fileStates.length}
            {maxFiles ? ` of ${maxFiles}` : ''} images
            {isUploading && ' · uploading…'}
          </span>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFiles}
            >
              Remove all
            </Button>
          )}
        </div>
      )}
      <UploadErrors errors={errors} onDismiss={clearErrors} />
    </div>
  );
}
