'use client';

import { cn } from '@/lib/utils';
import { AlertCircleIcon, UploadCloudIcon } from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { formatFileSize, useUploader } from './uploader-provider';

const DROPZONE_VARIANTS = {
  base: 'relative rounded-md p-4 w-full flex justify-center items-center flex-col cursor-pointer border-2 border-dashed border-muted-foreground transition-colors duration-200 ease-in-out',
  active: 'border-primary',
  disabled:
    'bg-muted border-muted-foreground cursor-default pointer-events-none opacity-50',
  accept: 'border-primary bg-primary/10',
  reject: 'border-destructive bg-destructive/10',
};

/**
 * Props for the Dropzone component.
 *
 * @interface DropzoneProps
 * @extends {React.HTMLAttributes<HTMLInputElement>}
 */
export interface DropzoneProps extends React.HTMLAttributes<HTMLInputElement> {
  /**
   * Options passed to the underlying react-dropzone component.
   * Cannot include 'disabled' or 'onDrop' as they are handled internally.
   */
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled' | 'onDrop'>;

  /**
   * Whether the dropzone is disabled.
   */
  disabled?: boolean;

  /**
   * Message shown when files are being dragged over the dropzone.
   */
  dropMessageActive?: string;

  /**
   * Default message shown when the dropzone is idle.
   */
  dropMessageDefault?: string;
}

/**
 * A dropzone component for file uploads that integrates with the UploaderProvider.
 *
 * @component
 * @example
 * ```tsx
 * <Dropzone
 *   dropzoneOptions={{
 *     maxFiles: 5,
 *     maxSize: 1024 * 1024 * 10, // 10MB
 *   }}
 * />
 * ```
 */
const Dropzone = React.forwardRef<HTMLInputElement, DropzoneProps>(
  (
    {
      dropzoneOptions,
      className,
      disabled,
      dropMessageActive = 'Drop files here...',
      dropMessageDefault = 'drag & drop files here, or click to select',
      ...props
    },
    ref,
  ) => {
    const { fileStates, addFiles } = useUploader();
    const [error, setError] = React.useState<string>();

    const maxFiles = dropzoneOptions?.maxFiles;
    const maxSize = dropzoneOptions?.maxSize;
    const isMaxFilesReached = !!maxFiles && fileStates.length >= maxFiles;
    const isDisabled = disabled ?? isMaxFilesReached;

    const {
      getRootProps,
      getInputProps,
      isDragActive,
      isFocused,
      isDragAccept,
      isDragReject,
    } = useDropzone({
      disabled: isDisabled,
      onDrop: (acceptedFiles, rejectedFiles) => {
        setError(undefined);

        // Handle rejections first
        if (rejectedFiles.length > 0) {
          if (rejectedFiles[0]?.errors[0]) {
            const error = rejectedFiles[0].errors[0];
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
          return; // Exit early if there are any rejections
        }

        // Handle accepted files
        if (acceptedFiles.length === 0) return;

        // Check if adding these files would exceed maxFiles limit
        if (maxFiles) {
          const remainingSlots = maxFiles - fileStates.length;
          // If adding all files would exceed the limit, reject them all
          if (acceptedFiles.length > remainingSlots) {
            setError(`You can only add ${maxFiles} file(s).`);
            return;
          }
        }

        addFiles(acceptedFiles);
      },
      ...dropzoneOptions,
    });

    const dropZoneClassName = React.useMemo(
      () =>
        cn(
          DROPZONE_VARIANTS.base,
          isFocused && DROPZONE_VARIANTS.active,
          isDisabled && DROPZONE_VARIANTS.disabled,
          isDragReject && DROPZONE_VARIANTS.reject,
          isDragAccept && DROPZONE_VARIANTS.accept,
          className,
        ),
      [isFocused, isDisabled, isDragAccept, isDragReject, className],
    );

    return (
      <div className="w-full">
        <div
          {...getRootProps({
            className: dropZoneClassName,
          })}
        >
          <input ref={ref} {...getInputProps()} {...props} />
          <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <UploadCloudIcon className="h-10 w-10" />
            <div className="text-sm font-medium">
              {isDragActive ? dropMessageActive : dropMessageDefault}
            </div>
            {(!!maxSize || !!maxFiles) && (
              <div className="text-xs">
                {maxFiles && maxFiles > 1 ? `Up to ${maxFiles} files` : ''}
                {maxFiles && maxFiles > 1 && maxSize ? ', ' : ''}
                {maxSize && `Max size: ${formatFileSize(maxSize)}`}
              </div>
            )}
          </div>
        </div>

        {/* Error Text */}
        {error && (
          <div className="mt-1 flex items-center text-xs text-destructive">
            <AlertCircleIcon className="mr-1 h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  },
);
Dropzone.displayName = 'Dropzone';

export { Dropzone };
