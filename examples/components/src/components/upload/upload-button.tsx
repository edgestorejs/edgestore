'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { type Accept } from 'react-dropzone';
import { dropzoneState, useUploadDropzone } from './dropzone';

/**
 * Props for the UploadButton component.
 */
export type UploadButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  'onClick' | 'type' | 'className'
> & {
  className?: string;

  /**
   * Accepted file types.
   */
  accept?: Accept;

  /**
   * Human-readable list of accepted types, used in messages.
   */
  typesLabel?: string;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Maximum number of files allowed in total.
   */
  maxFiles?: number;

  /**
   * Whether more than one file can be picked at once.
   * @default true
   */
  multiple?: boolean;

  /**
   * Called with messages about files that were not added
   * (wrong type, too large, over the limit).
   */
  onRejected?: (messages: string[]) => void;
};

/**
 * A button that opens the file dialog and also accepts files dropped onto it.
 * Several buttons can feed the same `UploaderProvider`.
 *
 * @example
 * ```tsx
 * <UploadButton maxSize={1024 * 1024 * 10} onRejected={setErrors}>
 *   <UploadIcon /> Upload files
 * </UploadButton>
 * ```
 */
export function UploadButton({
  accept,
  typesLabel,
  maxSize,
  maxFiles,
  multiple = true,
  onRejected,
  disabled,
  className,
  children,
  ...props
}: UploadButtonProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject, isFull } =
    useUploadDropzone({
      accept,
      typesLabel,
      maxSize,
      maxFiles,
      multiple,
      disabled,
      onRejected,
      // A <button> already opens the dialog on Enter and Space.
      noKeyboard: true,
    });

  // react-dropzone keeps its hidden input in the layout, so it is wrapped with the
  // button to keep it out of the parent's gaps.
  return (
    <span className="inline-flex">
      <Button
        {...props}
        {...getRootProps({ role: 'button' })}
        {...dropzoneState({ isDragActive, isDragReject })}
        type="button"
        disabled={disabled || isFull}
        className={cn(
          'data-[dragging]:ring-[3px] data-[dragging]:ring-ring/50 data-[rejected]:ring-destructive/40',
          className,
        )}
      >
        {children}
      </Button>
      <input {...getInputProps()} />
    </span>
  );
}
