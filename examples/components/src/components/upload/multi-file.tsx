'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { type Accept } from 'react-dropzone';
import { Dropzone } from './dropzone';
import { FileList } from './file-list';
import { formatFileSize } from './upload-utils';
import { useUploader } from './uploader-provider';

/**
 * Props for the FileUploader component.
 */
export type FileUploaderProps = React.ComponentProps<'div'> & {
  /**
   * Maximum number of files allowed in total.
   */
  maxFiles?: number;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Accepted file types.
   *
   * @example
   * ```tsx
   * accept={{ 'application/pdf': ['.pdf'] }}
   * ```
   */
  accept?: Accept;

  /**
   * Human-readable list of accepted types, shown in the hint and messages.
   *
   * @example "PDF or TXT"
   */
  typesLabel?: string;

  /**
   * Whether the uploader is disabled.
   */
  disabled?: boolean;

  /**
   * Additional className for the dropzone.
   */
  dropzoneClassName?: string;

  /**
   * Additional className for the file list.
   */
  fileListClassName?: string;
};

/**
 * A dropzone with a list of files, their progress and a summary.
 *
 * @example
 * ```tsx
 * <FileUploader
 *   maxFiles={5}
 *   maxSize={1024 * 1024 * 10} // 10MB
 *   accept={{ 'application/pdf': ['.pdf'] }}
 *   typesLabel="PDF"
 * />
 * ```
 */
export function FileUploader({
  maxFiles,
  maxSize,
  accept,
  typesLabel,
  disabled,
  className,
  dropzoneClassName,
  fileListClassName,
  ...props
}: FileUploaderProps) {
  const { fileStates, resetFiles } = useUploader();
  const completed = fileStates.filter((fs) => fs.status === 'COMPLETE').length;
  const totalSize = fileStates.reduce((sum, fs) => sum + fs.file.size, 0);

  return (
    <div className={cn('flex w-full flex-col gap-3', className)} {...props}>
      <Dropzone
        dropzoneOptions={{ maxFiles, maxSize, accept, typesLabel }}
        disabled={disabled}
        className={dropzoneClassName}
      />
      <FileList className={fileListClassName} disabled={disabled} />
      {fileStates.length > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {completed} of {fileStates.length} uploaded ·{' '}
            {formatFileSize(totalSize)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFiles}
            disabled={disabled}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
