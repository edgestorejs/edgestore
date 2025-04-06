'use client';

import { cn } from '@/lib/utils';
import { formatFileSize } from '@edgestore/react/utils';
import { AlertCircleIcon, UploadCloudIcon } from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import { useUploader } from './uploader-provider';

const DROPZONE_VARIANTS = {
  base: 'relative rounded-md p-4 w-full flex justify-center items-center flex-col cursor-pointer border-2 border-dashed border-gray-400 dark:border-gray-300 transition-colors duration-200 ease-in-out',
  active: 'border-blue-500',
  disabled:
    'bg-gray-200 border-gray-300 cursor-default pointer-events-none bg-opacity-30 dark:bg-gray-700 dark:border-gray-600',
  accept: 'border-blue-500 bg-blue-500 bg-opacity-10',
  reject: 'border-red-700 bg-red-700 bg-opacity-10',
};

export interface DropzoneProps extends React.HTMLAttributes<HTMLInputElement> {
  dropzoneOptions?: Omit<DropzoneOptions, 'disabled' | 'onDrop'>;
  disabled?: boolean;
  dropMessageActive?: string;
  dropMessageDefault?: string;
}

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
      onDropAccepted: (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        setError(undefined);

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
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <UploadCloudIcon className="h-10 w-10 text-gray-400" />
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {isDragActive ? dropMessageActive : dropMessageDefault}
            </div>
            {maxSize && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {maxFiles && maxFiles > 1 ? `Up to ${maxFiles} files, ` : ''}
                Max size: {formatFileSize(maxSize)}
              </div>
            )}
          </div>
        </div>

        {/* Error Text */}
        {error && (
          <div className="mt-1 flex items-center text-xs text-red-500 dark:text-red-400">
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
