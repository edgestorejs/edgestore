'use client';

import { cn } from '@/lib/utils';
import { UploadIcon } from 'lucide-react';
import * as React from 'react';
import { type Accept } from 'react-dropzone';
import { dropzoneState, dropzoneVariants, useUploadDropzone } from './dropzone';
import { FileListItem } from './multi-file';
import { formatFileSize } from './upload-utils';
import { useUploader } from './uploader-provider';

/**
 * Props for the FileField component.
 */
export type FileFieldProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  /**
   * Accepted file types.
   */
  accept?: Accept;

  /**
   * Human-readable list of accepted types, shown in the hint and messages.
   *
   * @example "PDF, DOC or DOCX"
   */
  typesLabel?: string;

  /**
   * Maximum file size in bytes.
   */
  maxSize?: number;

  /**
   * Whether the field is disabled.
   */
  disabled?: boolean;

  /**
   * Id for the hidden file input, so a `<label htmlFor>` opens the file dialog.
   */
  inputId?: string;
};

/**
 * A compact, single-file input that sits in a form next to regular fields.
 * Once a file is chosen, it shows the file with its progress instead.
 *
 * @example
 * ```tsx
 * <Label id="resume-label" htmlFor="resume">Resume</Label>
 * <FileField
 *   inputId="resume"
 *   aria-labelledby="resume-label"
 *   accept={{ 'application/pdf': ['.pdf'] }}
 *   typesLabel="PDF"
 *   maxSize={1024 * 1024 * 5} // 5MB
 * />
 * ```
 */
export function FileField({
  accept,
  typesLabel,
  maxSize,
  disabled,
  inputId,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  ...props
}: FileFieldProps) {
  const { fileStates } = useUploader();
  const fileState = fileStates[0];
  const errorId = React.useId();

  const { getRootProps, getInputProps, isDragActive, isDragReject, errors } =
    useUploadDropzone({ accept, maxSize, typesLabel, disabled, replace: true });

  const hint = [typesLabel, maxSize && formatFileSize(maxSize)]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cn('@container grid gap-1.5', className)} {...props}>
      {fileState ? (
        <ul>
          <FileListItem fileState={fileState} disabled={disabled} />
        </ul>
      ) : (
        <div
          {...getRootProps({
            role: 'button',
            'aria-label':
              ariaLabel ?? (ariaLabelledBy ? undefined : 'Upload a file'),
            'aria-labelledby': ariaLabelledBy,
            'aria-describedby':
              [ariaDescribedBy, errors.length > 0 && errorId]
                .filter(Boolean)
                .join(' ') || undefined,
            'aria-invalid': errors.length > 0 || undefined,
            className: cn(
              dropzoneVariants,
              'grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-1.5 rounded-lg bg-background px-3.5 py-3 text-left hover:bg-background aria-invalid:border-destructive @min-[22rem]:grid-cols-[auto_minmax(0,1fr)_auto]',
            ),
          })}
          {...dropzoneState({ isDragActive, isDragReject, disabled })}
        >
          <input {...getInputProps({ id: inputId, className: 'absolute' })} />
          <UploadIcon className="size-4 text-muted-foreground group-data-[dragging]/dropzone:text-primary" />
          <span className="min-w-0 text-sm group-data-[rejected]/dropzone:text-destructive">
            {isDragReject ? (
              'File type not supported'
            ) : isDragActive ? (
              'Drop to upload'
            ) : (
              <>
                Drop a file or{' '}
                <span className="font-semibold text-primary">browse</span>
              </>
            )}
          </span>
          {hint && (
            <span className="col-start-2 text-xs text-muted-foreground @min-[22rem]:col-start-3">
              {hint}
            </span>
          )}
        </div>
      )}
      {errors[0] && (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errors[0]}
        </p>
      )}
    </div>
  );
}
