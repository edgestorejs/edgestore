'use client';

import { cn } from '@/lib/utils';
import { AlertCircleIcon, UploadIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';
import {
  describeLimits,
  rejectionMessages,
  uploadErrorMessage,
} from './upload-utils';
import { useUploader } from './uploader-provider';

/**
 * Options for the `useUploadDropzone` hook.
 */
export type UseUploadDropzoneOptions = Omit<
  DropzoneOptions,
  'onDrop' | 'getErrorMessage' | 'maxFiles'
> & {
  /**
   * Maximum number of files the uploader can hold in total.
   * Extra files in a drop are skipped with a message.
   */
  maxFiles?: number;

  /**
   * Swap the current file for the dropped one instead of adding it.
   * Implies `multiple: false`.
   */
  replace?: boolean;

  /**
   * Human-readable list of accepted types, used in messages. e.g. "PNG or JPG"
   */
  typesLabel?: string;

  /**
   * Called with the messages for files that were not added.
   */
  onRejected?: (messages: string[]) => void;
};

/**
 * `useDropzone` wired to the nearest `UploaderProvider`.
 * Adds what fits, skips the rest and keeps a list of messages about skipped files.
 *
 * @example
 * ```tsx
 * const { getRootProps, getInputProps, errors } = useUploadDropzone({ maxFiles: 5 });
 * ```
 */
export function useUploadDropzone({
  maxFiles,
  replace,
  typesLabel,
  onRejected,
  disabled,
  ...options
}: UseUploadDropzoneOptions = {}) {
  const { fileStates, addFiles, removeFile } = useUploader();
  const [errors, setErrors] = React.useState<string[]>([]);
  const isFull =
    !replace && maxFiles !== undefined && fileStates.length >= maxFiles;

  const multiple = options.multiple ?? !replace;

  const dropzone = useDropzone({
    ...options,
    multiple,
    disabled: disabled || isFull,
    getErrorMessage: uploadErrorMessage({
      maxSize: options.maxSize,
      minSize: options.minSize,
      maxFiles: multiple ? maxFiles : 1,
      typesLabel,
    }),
    onDrop: (accepted, rejected) => {
      const messages = rejectionMessages(rejected);
      if (replace) {
        if (accepted.length > 0) {
          fileStates.forEach((fileState) => removeFile(fileState.key));
          addFiles(accepted.slice(0, 1));
        }
      } else {
        // react-dropzone's `maxFiles` only counts a single drop, so the total is enforced here.
        const room =
          maxFiles === undefined
            ? accepted.length
            : Math.max(maxFiles - fileStates.length, 0);
        if (accepted.length > room) {
          messages.push(
            `You can add up to ${maxFiles} files. ${accepted.length - room} skipped.`,
          );
        }
        addFiles(accepted.slice(0, room));
      }
      setErrors(messages);
      if (messages.length > 0) onRejected?.(messages);
    },
  });

  const clearErrors = React.useCallback(() => setErrors([]), []);

  return { ...dropzone, errors, clearErrors, isFull };
}

/**
 * Data attributes that drive the drag styles of `dropzoneVariants`.
 */
export function dropzoneState({
  isDragActive,
  isDragReject,
  disabled,
}: {
  isDragActive?: boolean;
  isDragReject?: boolean;
  disabled?: boolean;
}) {
  return {
    'data-dragging': isDragActive || undefined,
    'data-rejected': isDragReject || undefined,
    'data-disabled': disabled || undefined,
  };
}

/**
 * Base classes for a drop area. Pair with `dropzoneState()`.
 */
export const dropzoneVariants =
  'group/dropzone relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted-foreground/30 bg-muted/40 text-center outline-none transition-[border-color,background-color,box-shadow] hover:border-primary/50 hover:bg-muted/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[dragging]:border-solid data-[dragging]:border-primary data-[dragging]:bg-primary/5 data-[rejected]:border-destructive data-[rejected]:bg-destructive/5 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 data-[disabled]:hover:border-muted-foreground/30 data-[disabled]:hover:bg-muted/40';

/**
 * Icon, title and hint shown inside an empty drop area.
 */
export function DropzonePrompt({
  icon = <UploadIcon />,
  title,
  hint,
  isDragActive,
  isDragReject,
  activeText = 'Drop to upload',
  rejectText = 'File type not supported',
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  hint?: React.ReactNode;
  isDragActive?: boolean;
  isDragReject?: boolean;
  activeText?: string;
  rejectText?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none flex flex-col items-center gap-1 px-5 py-7',
        className,
      )}
    >
      <span className="mb-2 grid size-11 place-items-center rounded-xl border bg-background text-muted-foreground shadow-xs transition group-data-[dragging]/dropzone:-translate-y-0.5 group-data-[dragging]/dropzone:border-primary/40 group-data-[dragging]/dropzone:text-primary group-data-[rejected]/dropzone:border-destructive/40 group-data-[rejected]/dropzone:text-destructive motion-reduce:transition-none [&_svg]:size-5">
        {icon}
      </span>
      <p className="text-sm font-medium group-data-[rejected]/dropzone:text-destructive">
        {isDragReject ? rejectText : isDragActive ? activeText : title}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Covers a drop area that already shows files while something is dragged over it.
 */
export function DropzoneOverlay({
  isDragReject,
  children,
}: {
  isDragReject?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-rejected={isDragReject || undefined}
      className="pointer-events-none absolute inset-0 z-10 grid animate-in place-items-center rounded-[inherit] border-2 border-primary bg-background/80 p-4 text-sm font-semibold text-primary backdrop-blur-[2px] fade-in-0 data-[rejected]:border-destructive data-[rejected]:text-destructive"
    >
      {children}
    </div>
  );
}

/**
 * Lists messages about files that were not added.
 */
export function UploadErrors({
  errors,
  onDismiss,
  className,
}: {
  errors: string[];
  onDismiss?: () => void;
  className?: string;
}) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className={cn(
        'flex animate-in items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 py-2 pr-2 pl-3 text-sm text-destructive fade-in-0',
        className,
      )}
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      <ul className="grid flex-1 gap-0.5 break-words">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="grid size-5 shrink-0 place-items-center rounded-md outline-none hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Props for the Dropzone component.
 */
export type DropzoneProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  /**
   * Options passed to `useUploadDropzone` (and react-dropzone).
   */
  dropzoneOptions?: UseUploadDropzoneOptions;

  /**
   * Whether the dropzone is disabled.
   */
  disabled?: boolean;

  /**
   * Icon shown above the title.
   */
  icon?: React.ReactNode;

  /**
   * Title shown when idle.
   */
  title?: React.ReactNode;

  /**
   * Hint shown below the title. Defaults to a summary of the limits.
   */
  hint?: React.ReactNode;

  /**
   * Title shown while files are dragged over the dropzone.
   */
  activeText?: string;
};

/**
 * A drop area that adds files to the nearest `UploaderProvider`.
 *
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
export function Dropzone({
  dropzoneOptions,
  disabled,
  icon,
  title,
  hint,
  activeText = 'Drop files to upload',
  className,
  ...props
}: DropzoneProps) {
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
    errors,
    clearErrors,
    isFull,
  } = useUploadDropzone({ ...dropzoneOptions, disabled });

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        {...getRootProps({
          role: 'button',
          'aria-label': 'Upload files',
          ...props,
          className: cn(dropzoneVariants, 'min-h-40', className),
        })}
        {...dropzoneState({
          isDragActive,
          isDragReject,
          disabled: disabled || isFull,
        })}
      >
        <input {...getInputProps()} />
        <DropzonePrompt
          icon={icon}
          isDragActive={isDragActive}
          isDragReject={isDragReject}
          activeText={activeText}
          title={
            isFull
              ? 'File limit reached'
              : (title ?? (
                  <>
                    <span className="font-semibold text-primary">
                      Click to upload
                    </span>{' '}
                    or drag and drop
                  </>
                ))
          }
          hint={hint ?? describeLimits(dropzoneOptions ?? {})}
        />
      </div>
      <UploadErrors errors={errors} onDismiss={clearErrors} />
    </div>
  );
}
