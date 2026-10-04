'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CameraIcon, Loader2Icon, UserIcon } from 'lucide-react';
import * as React from 'react';
import { type Accept } from 'react-dropzone';
import { dropzoneState, useUploadDropzone } from './dropzone';
import { ProgressCircle } from './progress-circle';
import {
  formatFileSize,
  IMAGE_ACCEPT,
  minImageSize,
  useObjectUrl,
} from './upload-utils';
import { useUploader } from './uploader-provider';

/**
 * Props for the AvatarDropzone component.
 */
export type AvatarDropzoneProps = Omit<
  React.ComponentProps<'div'>,
  'children'
> & {
  /**
   * Label shown next to the image and used in accessible labels.
   * @default "Profile photo"
   */
  label?: string;

  /**
   * Help text shown under the label. Defaults to a summary of the limits.
   */
  description?: React.ReactNode;

  /**
   * Shape of the image.
   * @default "circle"
   */
  shape?: 'circle' | 'square';

  /**
   * Size of the image in pixels.
   * @default 88
   */
  size?: number;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Minimum width and height of the image in pixels.
   */
  minDimension?: number;

  /**
   * Accepted image types.
   * @default PNG, JPG, WEBP and GIF
   */
  accept?: Accept;

  /**
   * Human-readable list of accepted types, shown in the description and messages.
   * @default "PNG, JPG, WEBP or GIF"
   */
  typesLabel?: string;

  /**
   * Shown when there is no image.
   */
  placeholder?: React.ReactNode;

  /**
   * Whether the dropzone is disabled.
   */
  disabled?: boolean;
};

/**
 * A single image in a fixed shape, for profile photos and logos.
 * Click or drop onto the image to replace it.
 *
 * @example
 * ```tsx
 * <AvatarDropzone
 *   label="Profile photo"
 *   maxSize={1024 * 1024 * 2} // 2MB
 *   minDimension={128}
 * />
 * ```
 */
export function AvatarDropzone({
  label = 'Profile photo',
  description,
  shape = 'circle',
  size = 88,
  maxSize,
  minDimension,
  accept = IMAGE_ACCEPT,
  typesLabel = 'PNG, JPG, WEBP or GIF',
  placeholder,
  disabled,
  className,
  ...props
}: AvatarDropzoneProps) {
  const { fileStates, removeFile, uploadFiles } = useUploader();
  const fileState = fileStates[0];
  const preview = useObjectUrl(fileState?.file);
  const src = preview ?? fileState?.url;

  const validator = React.useMemo(
    () => (minDimension ? minImageSize(minDimension) : undefined),
    [minDimension],
  );

  const {
    getRootProps,
    getInputProps,
    open,
    isDragActive,
    isDragReject,
    isProcessing,
    errors,
    clearErrors,
  } = useUploadDropzone({
    accept,
    maxSize,
    typesLabel,
    disabled,
    validator,
    replace: true,
  });

  const isBusy = isProcessing || fileState?.status === 'UPLOADING';
  const accessibleLabel = label.toLowerCase();

  return (
    <div className={cn('flex items-start gap-4', className)} {...props}>
      <div
        {...getRootProps({
          role: 'button',
          'aria-label': fileState
            ? `Change ${accessibleLabel}`
            : `Upload ${accessibleLabel}`,
          style: { width: size, height: size },
          className: cn(
            'group/avatar relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden border-[1.5px] border-dashed border-muted-foreground/30 bg-muted/40 text-muted-foreground/70 transition-[border-color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[dragging]:border-2 data-[dragging]:border-solid data-[dragging]:border-primary data-[dragging]:ring-4 data-[dragging]:ring-primary/20 data-[rejected]:border-destructive data-[rejected]:ring-destructive/20',
            shape === 'circle' ? 'rounded-full' : 'rounded-xl',
            src && 'border-solid border-border',
            fileState?.status === 'ERROR' && 'border-destructive',
          ),
        })}
        {...dropzoneState({ isDragActive, isDragReject, disabled })}
      >
        <input {...getInputProps()} />
        {src ? (
          <img src={src} alt="" className="size-full object-cover" />
        ) : (
          (placeholder ?? (
            <UserIcon
              strokeWidth={1.5}
              style={{ width: size * 0.4, height: size * 0.4 }}
            />
          ))
        )}
        {!disabled && (
          <span
            aria-hidden="true"
            className="absolute inset-0 grid place-items-center bg-black/55 text-white opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100 group-data-[dragging]/avatar:opacity-100"
          >
            <CameraIcon style={{ width: size * 0.24, height: size * 0.24 }} />
          </span>
        )}
        {isBusy && (
          <span className="absolute inset-0 grid place-items-center bg-black/55 text-white">
            {isProcessing ? (
              <Loader2Icon className="size-5 animate-spin" />
            ) : (
              <ProgressCircle
                progress={fileState?.progress ?? 0}
                size={Math.min(44, size * 0.55)}
                strokeWidth={3}
                showValue={size >= 72}
                className="text-[10px]"
              />
            )}
          </span>
        )}
      </div>

      <div className="grid min-w-0 gap-1.5">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">
          {description ??
            [
              typesLabel,
              minDimension && `at least ${minDimension}×${minDimension}px`,
              maxSize && `up to ${formatFileSize(maxSize)}`,
            ]
              .filter(Boolean)
              .join(', ')}
        </p>
        {!disabled && (
          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={open}
              disabled={isBusy}
            >
              {fileState ? 'Change' : 'Upload'}
            </Button>
            {fileState && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  removeFile(fileState.key);
                  clearErrors();
                }}
              >
                Remove
              </Button>
            )}
          </div>
        )}
        {fileState?.status === 'ERROR' && (
          <p className="text-sm text-destructive">
            {fileState.error ?? 'Upload failed'}{' '}
            {!disabled && (
              <button
                type="button"
                onClick={() => void uploadFiles([fileState.key])}
                className="font-medium underline underline-offset-2"
              >
                Retry
              </button>
            )}
          </p>
        )}
        {errors[0] && (
          <p role="alert" className="text-sm text-destructive">
            {errors[0]}
          </p>
        )}
      </div>
    </div>
  );
}
