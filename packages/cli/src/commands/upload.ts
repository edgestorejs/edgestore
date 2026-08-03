import { openAsBlob } from 'node:fs';
import { glob, stat } from 'node:fs/promises';
import path from 'node:path';
import { EdgeStoreUploadCleanupError } from '@edgestore/sdk';
import { renderCliCommand } from '../core/command';
import { CliError, normalizeError, usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import { resolvedProjectRef } from './project';

export async function fileUploadCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    paths: string[];
    bucket: string;
    project?: string;
    path?: string;
    keepName?: boolean;
  },
): Promise<void> {
  if (flags.plain) {
    throw usageError(
      'plain_output_unavailable',
      'File upload does not have a single plain-text result.',
      ['Use --json to inspect every upload result.'],
    );
  }
  const localFiles = await expandFiles(runtime.cwd, input.paths);
  if (!localFiles.length) {
    throw usageError('upload_files_missing', 'No matching files were found.');
  }
  if (input.path) validateRemotePath(input.path);
  if (localFiles.length > 1 && input.path && !input.path.endsWith('/')) {
    throw usageError(
      'upload_path_not_prefix',
      '--path must end in / when uploading multiple files.',
    );
  }

  const project = await resolvedProjectRef(runtime, input.project);
  const sdk = await sdkFor(runtime, flags);
  const results = [];
  for (const [index, localFile] of localFiles.entries()) {
    try {
      const fileName = path.basename(localFile);
      const mimeType = mimeTypeFor(fileName);
      const destination =
        input.path && localFiles.length > 1
          ? `${input.path}${fileName}`
          : input.path;
      const source = await openAsBlob(
        localFile,
        mimeType ? { type: mimeType } : undefined,
      );
      try {
        const completed = await sdk.management.uploads.upload({
          project,
          bucket: input.bucket,
          source,
          ...(input.keepName ? { fileName } : {}),
          ...(destination ? { path: destination } : {}),
          mimeType,
          signal: runtime.signal,
          onProgress: (progress) =>
            reportProgress(runtime, flags, {
              fileName,
              percentage: progress.percentage,
            }),
        });
        results.push({ localPath: localFile, ...completed });
      } catch (error) {
        throw normalizeUploadError(error, { runtime, flags, project });
      }
    } catch (error) {
      if (localFiles.length === 1) throw error;
      const cause = normalizeError(error);
      const notAttemptedPaths = localFiles.slice(index + 1);
      throw new CliError(
        'file_upload_incomplete',
        [
          `Upload batch stopped while processing ${localFile}: ${cause.message}`,
          `Completed (${results.length}):`,
          ...results.map(
            (result) =>
              `  ${result.localPath} -> ${result.file.url} (${result.file.id})`,
          ),
          `Interrupted: ${localFile}`,
          `Not attempted (${notAttemptedPaths.length}):`,
          ...notAttemptedPaths.map((file) => `  ${file}`),
        ].join('\n'),
        {
          details: {
            completed: results,
            interruptedPath: localFile,
            notAttemptedPaths,
            cause: errorDetails(cause),
          },
          requestId: cause.options.requestId,
          suggestions: cause.options.suggestions,
          exitCode: cause.exitCode,
        },
      );
    }
  }
  const human = results
    .map((result) => {
      const readUrl = result.signedReadUrl?.signedUrl ?? result.file.url;
      return `${path.basename(result.localPath)} -> ${readUrl} (${result.file.id})`;
    })
    .join('\n');
  outputFor(runtime, flags).result({ uploads: results }, human);
}

function normalizeUploadError(
  error: unknown,
  context: {
    runtime: CliRuntime;
    flags: GlobalFlags;
    project: string;
  },
): CliError {
  const { runtime, flags, project } = context;
  if (error instanceof EdgeStoreUploadCleanupError) {
    const cause = runtime.signal.aborted
      ? interruptedError()
      : normalizeError(error.uploadCause);
    const cleanup = normalizeError(error.cleanupCause);
    return new CliError(
      'upload_cleanup_failed',
      `${cause.message} Automatic cancellation of upload ${error.uploadId} failed.`,
      {
        details: {
          cause: errorDetails(cause),
          cleanup: {
            status: 'failed',
            uploadId: error.uploadId,
            error: errorDetails(cleanup),
          },
        },
        requestId: cause.options.requestId,
        suggestions: [
          ...(cause.options.suggestions ?? []),
          renderCliCommand(
            flags,
            ['file', 'upload-cancel', error.uploadId, '--yes'],
            { project },
          ),
        ],
        exitCode: cause.exitCode,
      },
    );
  }
  if (runtime.signal.aborted) return interruptedError();
  if (isFileBlobMutation(error)) {
    return new CliError(
      'upload_source_changed',
      'The upload source changed while it was being read.',
    );
  }
  return normalizeError(error);
}

function interruptedError(): CliError {
  return new CliError('interrupted', 'Operation canceled.', { exitCode: 130 });
}

function isFileBlobMutation(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotReadableError';
}

function reportProgress(
  runtime: CliRuntime,
  flags: GlobalFlags,
  progress: { fileName: string; percentage: number },
): void {
  if (flags.progress && !flags.json && runtime.io.outputIsTty) {
    runtime.io.stderr.write(
      `${progress.fileName}: uploading ${progress.percentage}%\n`,
    );
  }
}

export async function fileUploadStatusCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { uploadId: string; project?: string },
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.uploads.get({
    project: await resolvedProjectRef(runtime, input.project),
    uploadId: input.uploadId,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    'file' in result
      ? `Upload ${input.uploadId}: completed\nURL: ${result.file.url}`
      : `Upload ${input.uploadId}: ${result.upload.status}`,
    result.upload.status,
  );
}

export async function fileUploadCancelCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { uploadId: string; project?: string; yes?: boolean },
): Promise<void> {
  const project = await resolvedProjectRef(runtime, input.project);
  if (!input.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Upload cancellation requires confirmation.',
        [
          renderCliCommand(
            flags,
            ['file', 'upload-cancel', input.uploadId, '--yes'],
            { project },
          ),
        ],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type ${input.uploadId} to cancel this upload`,
      input.uploadId,
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.uploads.cancel({
    project,
    uploadId: input.uploadId,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Upload ${input.uploadId}: ${result.upload.status}`,
    result.upload.status,
  );
}

async function expandFiles(cwd: string, patterns: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const pattern of patterns) {
    const literalPath = path.resolve(cwd, pattern);
    try {
      if ((await stat(literalPath)).isFile()) {
        files.add(literalPath);
        continue;
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error;
    }
    for await (const match of glob(pattern, { cwd })) {
      const absolute = path.resolve(cwd, match);
      if ((await stat(absolute)).isFile()) files.add(absolute);
    }
  }
  return [...files];
}

function errorDetails(error: CliError): Record<string, unknown> {
  return {
    code: error.code,
    message: error.message,
    ...(error.options.details === undefined
      ? {}
      : { details: error.options.details }),
    ...(error.options.requestId ? { requestId: error.options.requestId } : {}),
  };
}

function validateRemotePath(value: string): void {
  if (
    value.startsWith('/') ||
    value.split('/').includes('..') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw usageError('invalid_upload_path', 'The upload path is unsafe.');
  }
}

function mimeTypeFor(fileName: string): string | undefined {
  const extension = path.extname(fileName).toLowerCase();
  return {
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.webp': 'image/webp',
  }[extension];
}
