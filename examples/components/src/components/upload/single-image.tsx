'use client';

import { cn } from '@/lib/utils';
import {
  ImageIcon,
  RefreshCwIcon,
  RotateCwIcon,
  Trash2Icon,
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
import { useUploader } from './uploader-provider';

function OverlayButton({
  label,
  className,
  ...props
}: React.ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid size-7 place-items-center rounded-md bg-black/60 text-white backdrop-blur-sm transition-colors outline-none hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white/70 [&_svg]:size-3.5',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Props for the SingleImageDropzone component.
 */
export type SingleImageDropzoneProps = React.ComponentProps<'div'> & {
  /**
   * CSS aspect ratio of the dropzone. Set the width with `className`.
   * @default "1 / 1"
   */
  aspectRatio?: string;

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
   * Name of the image, used in accessible labels.
   * @default "image"
   */
  label?: string;

  /**
   * Whether the dropzone is disabled.
   */
  disabled?: boolean;
};

/**
 * One image in a fixed aspect ratio: avatars, covers, thumbnails.
 * Dropping or choosing a new image replaces the current one.
 *
 * @example
 * ```tsx
 * <SingleImageDropzone
 *   className="w-64"
 *   aspectRatio="16 / 9"
 *   maxSize={1024 * 1024 * 2} // 2MB
 * />
 * ```
 */
export function SingleImageDropzone({
  aspectRatio = '1 / 1',
  maxSize,
  accept = IMAGE_ACCEPT,
  typesLabel = 'PNG, JPG, WEBP or GIF',
  label = 'image',
  disabled,
  className,
  ...props
}: SingleImageDropzoneProps) {
  const { fileStates, removeFile, cancelUpload, uploadFiles } = useUploader();
  const fileState = fileStates[0];
  const preview = useObjectUrl(fileState?.file);
  const src = preview ?? fileState?.url;

  const {
    getRootProps,
    getInputProps,
    open,
    isDragActive,
    isDragReject,
    errors,
    clearErrors,
  } = useUploadDropzone({
    accept,
    maxSize,
    typesLabel,
    disabled,
    replace: true,
    // With an image shown, the Replace button opens the dialog instead of click-anywhere.
    noClick: !!fileState,
    noKeyboard: !!fileState,
  });

  return (
    <div className={cn('flex w-full flex-col gap-3', className)} {...props}>
      <div
        {...getRootProps({
          role: fileState ? 'group' : 'button',
          'aria-label': fileState
            ? `${label}. Drop an image to replace it.`
            : `Upload ${label}`,
          style: { aspectRatio },
          className: cn(
            dropzoneVariants,
            'overflow-hidden',
            fileState &&
              'cursor-default border-solid border-border bg-muted hover:border-border hover:bg-muted',
          ),
        })}
        {...dropzoneState({ isDragActive, isDragReject, disabled })}
      >
        <input {...getInputProps()} />
        {fileState ? (
          <>
            {src && (
              <img
                src={src}
                alt={fileState.file.name}
                className="absolute inset-0 size-full animate-in object-cover fade-in-0"
              />
            )}
            {fileState.status === 'UPLOADING' && (
              <ProgressBar
                progress={fileState.progress}
                aria-label={`Uploading ${fileState.file.name}`}
                className="absolute inset-x-0 top-0 h-[3px] rounded-none bg-white/25"
                indicatorClassName="rounded-none"
              />
            )}
            {fileState.status === 'ERROR' && (
              <p className="absolute inset-x-2.5 top-2.5 rounded-md bg-destructive px-2.5 py-1.5 text-left text-xs font-medium text-white">
                {fileState.error ?? 'Upload failed'}
              </p>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-linear-to-t from-black/60 to-transparent px-2.5 pt-8 pb-2.5 text-left text-white">
              <span className="min-w-0 truncate pb-1 text-xs opacity-90">
                {fileState.file.name} · {formatFileSize(fileState.file.size)}
              </span>
              {!disabled && (
                <div className="flex shrink-0 gap-1.5">
                  {fileState.status === 'ERROR' && (
                    <OverlayButton
                      label="Retry upload"
                      onClick={() => void uploadFiles([fileState.key])}
                    >
                      <RotateCwIcon />
                    </OverlayButton>
                  )}
                  <OverlayButton label={`Replace ${label}`} onClick={open}>
                    <RefreshCwIcon />
                  </OverlayButton>
                  {fileState.status === 'UPLOADING' ? (
                    <OverlayButton
                      label="Cancel upload"
                      onClick={() => cancelUpload(fileState.key)}
                    >
                      <XIcon />
                    </OverlayButton>
                  ) : (
                    <OverlayButton
                      label={`Remove ${label}`}
                      onClick={() => {
                        removeFile(fileState.key);
                        clearErrors();
                      }}
                    >
                      <Trash2Icon />
                    </OverlayButton>
                  )}
                </div>
              )}
            </div>
            {isDragActive && (
              <DropzoneOverlay isDragReject={isDragReject}>
                {isDragReject ? 'Only images are supported' : 'Drop to replace'}
              </DropzoneOverlay>
            )}
          </>
        ) : (
          <DropzonePrompt
            icon={<ImageIcon />}
            isDragActive={isDragActive}
            isDragReject={isDragReject}
            activeText="Drop image here"
            rejectText="Only images are supported"
            title={
              <>
                <span className="font-semibold text-primary">
                  Click to upload
                </span>{' '}
                or drag and drop
              </>
            }
            hint={describeLimits({ typesLabel, maxSize, maxFiles: 1 })}
          />
        )}
      </div>
      <UploadErrors errors={errors} onDismiss={clearErrors} />
    </div>
  );
}
