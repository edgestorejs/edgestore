'use client';

import * as React from 'react';
import {
  type Accept,
  type FileError,
  type FileRejection,
} from 'react-dropzone';

export const IMAGE_ACCEPT: Accept = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

export const DOCUMENT_ACCEPT: Accept = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    '.docx',
  ],
};

export const SPREADSHEET_ACCEPT: Accept = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    '.xlsx',
  ],
};

/**
 * Formats a file size in bytes to a human-readable string.
 *
 * @example
 * ```ts
 * formatFileSize(1024); // "1 KB"
 * formatFileSize(1024 * 1024 * 2.5); // "2.5 MB"
 * ```
 */
export function formatFileSize(bytes?: number) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value < 10 ? Number(value.toFixed(1)) : Math.round(value)} ${units[i]}`;
}

export function fileExtension(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export type FileKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'doc'
  | 'sheet'
  | 'slides'
  | 'archive'
  | 'code'
  | 'other';

const KIND_BY_EXTENSION: Record<string, FileKind> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'doc',
  txt: 'doc',
  md: 'doc',
  rtf: 'doc',
  xls: 'sheet',
  xlsx: 'sheet',
  csv: 'sheet',
  ppt: 'slides',
  pptx: 'slides',
  key: 'slides',
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  js: 'code',
  ts: 'code',
  tsx: 'code',
  jsx: 'code',
  json: 'code',
  html: 'code',
  css: 'code',
  py: 'code',
};

export function fileKind(file: File): FileKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return KIND_BY_EXTENSION[fileExtension(file.name)] ?? 'other';
}

export type UploadLimits = {
  maxSize?: number;
  minSize?: number;
  maxFiles?: number;
  /** Human-readable list of accepted types, e.g. "PNG or JPG". */
  typesLabel?: string;
};

/**
 * Friendlier rejection messages than react-dropzone's defaults
 * ("File is larger than 1048576 bytes"). Pass it to the `getErrorMessage` option.
 */
export function uploadErrorMessage(limits: UploadLimits) {
  return (error: FileError, file: File): string => {
    switch (error.code) {
      case 'file-too-large':
        return `${file.name} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(limits.maxSize)}.`;
      case 'file-too-small':
        return `${file.name} is smaller than ${formatFileSize(limits.minSize)}.`;
      case 'file-invalid-type':
        return limits.typesLabel
          ? `${file.name} isn't supported. Use ${limits.typesLabel}.`
          : `${file.name} isn't a supported file type.`;
      case 'too-many-files':
        if (limits.maxFiles === 1) return 'Choose a single file.';
        return limits.maxFiles
          ? `You can add up to ${limits.maxFiles} files.`
          : 'Too many files.';
      default:
        return error.message;
    }
  };
}

/** Flattens rejections into unique, human-readable messages. */
export function rejectionMessages(rejections: readonly FileRejection[]) {
  return [
    ...new Set(rejections.flatMap((r) => r.errors.map((e) => e.message))),
  ];
}

/** Short summary of the limits, e.g. "PNG or JPG · up to 2 MB · 5 max". */
export function describeLimits({
  typesLabel,
  maxSize,
  maxFiles,
}: UploadLimits) {
  return [
    typesLabel,
    maxSize &&
      `up to ${formatFileSize(maxSize)}${maxFiles === 1 ? '' : ' each'}`,
    maxFiles && maxFiles > 1 && `${maxFiles} max`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Async validator that rejects images smaller than `min` pixels on either side.
 * Pass it to the `validator` option.
 */
export function minImageSize(min: number) {
  return async (file: File): Promise<FileError | null> => {
    // Let `accept` report the type error.
    if (!file.type.startsWith('image/')) return null;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      if (img.naturalWidth < min || img.naturalHeight < min) {
        return {
          code: 'image-too-small',
          message: `${file.name} is ${img.naturalWidth}×${img.naturalHeight}px. Use at least ${min}×${min}px.`,
        };
      }
      return null;
    } catch {
      return {
        code: 'image-unreadable',
        message: `${file.name} couldn't be read as an image.`,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
}

/**
 * Returns an object URL for previewing `file`, created once per file and
 * revoked when the file changes or the component unmounts.
 */
export function useObjectUrl(file?: File | null) {
  const [url, setUrl] = React.useState<string>();

  React.useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(undefined);
    };
  }, [file]);

  return url;
}
