'use client';

import { cn } from '@/lib/utils';
import { CheckIcon, RotateCwIcon, XIcon } from 'lucide-react';
import * as React from 'react';
import { ProgressBar } from './progress-bar';
import {
  fileExtension,
  fileKind,
  formatFileSize,
  type FileKind,
} from './upload-utils';
import { useUploader, type FileState } from './uploader-provider';

const KIND_CLASSNAMES: Record<FileKind, string> = {
  image: 'text-purple-600 dark:text-purple-400',
  video: 'text-pink-600 dark:text-pink-400',
  audio: 'text-cyan-600 dark:text-cyan-400',
  pdf: 'text-red-600 dark:text-red-400',
  doc: 'text-blue-600 dark:text-blue-400',
  sheet: 'text-green-600 dark:text-green-400',
  slides: 'text-orange-600 dark:text-orange-400',
  archive: 'text-yellow-600 dark:text-yellow-400',
  code: 'text-teal-600 dark:text-teal-400',
  other: 'text-muted-foreground',
};

/**
 * A colored tile with the file's extension.
 */
export function FileBadge({
  file,
  className,
}: {
  file: File;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-10 w-9 shrink-0 place-items-center rounded-md border border-current/25 bg-current/10 font-mono text-[10px] font-bold uppercase',
        KIND_CLASSNAMES[fileKind(file)],
        className,
      )}
    >
      {fileExtension(file.name).slice(0, 4) || 'file'}
    </span>
  );
}

function IconButton({
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
        'grid size-8 place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

/**
 * One file with its status, progress and actions (retry, cancel, remove).
 */
export function FileListItem({
  fileState,
  disabled,
  className,
  ...props
}: React.ComponentProps<'li'> & {
  fileState: FileState;
  /** Hides the retry, cancel and remove actions. */
  disabled?: boolean;
}) {
  const { removeFile, cancelUpload, uploadFiles } = useUploader();
  const { file, key, status, progress, error } = fileState;

  return (
    <li
      data-status={status}
      className={cn(
        'relative flex animate-in items-center gap-3 overflow-hidden rounded-xl border bg-background py-2.5 pr-2 pl-2.5 fade-in-0 slide-in-from-top-1 data-[status=ERROR]:border-destructive/40',
        className,
      )}
      {...props}
    >
      <FileBadge file={file} />
      <div className="grid min-w-0 flex-1 gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </span>
          {status === 'COMPLETE' && (
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500">
              <CheckIcon className="size-2.5" strokeWidth={4} />
              <span className="sr-only">Uploaded</span>
            </span>
          )}
        </div>
        <p
          className={cn(
            'text-xs text-muted-foreground tabular-nums',
            status === 'ERROR' && 'text-destructive',
          )}
        >
          {status === 'ERROR'
            ? (error ?? 'Upload failed')
            : status === 'UPLOADING'
              ? `${formatFileSize((file.size * progress) / 100)} of ${formatFileSize(file.size)} · ${Math.round(progress)}%`
              : formatFileSize(file.size)}
        </p>
      </div>
      {/* Pinned to the bottom edge so the row keeps its height when the upload ends. */}
      {status === 'UPLOADING' && (
        <ProgressBar
          progress={progress}
          aria-label={`Uploading ${file.name}`}
          className="absolute inset-x-0 bottom-0 h-0.5 rounded-none bg-transparent"
          indicatorClassName="rounded-none"
        />
      )}
      {!disabled && (
        <div className="flex items-center">
          {status === 'ERROR' && (
            <IconButton
              label={`Retry ${file.name}`}
              onClick={() => void uploadFiles([key])}
            >
              <RotateCwIcon />
            </IconButton>
          )}
          {status === 'UPLOADING' ? (
            <IconButton
              label={`Cancel ${file.name}`}
              onClick={() => cancelUpload(key)}
            >
              <XIcon />
            </IconButton>
          ) : (
            <IconButton
              label={`Remove ${file.name}`}
              onClick={() => removeFile(key)}
            >
              <XIcon />
            </IconButton>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Lists the files of the nearest `UploaderProvider`.
 *
 * @example
 * ```tsx
 * <FileList className="my-4" />
 * ```
 */
export function FileList({
  disabled,
  className,
  ...props
}: React.ComponentProps<'ul'> & {
  /** Hides the retry, cancel and remove actions. */
  disabled?: boolean;
}) {
  const { fileStates } = useUploader();
  if (fileStates.length === 0) return null;

  return (
    <ul
      aria-label="Files"
      className={cn('grid w-full gap-2', className)}
      {...props}
    >
      {fileStates.map((fileState) => (
        <FileListItem
          key={fileState.key}
          fileState={fileState}
          disabled={disabled}
        />
      ))}
    </ul>
  );
}
