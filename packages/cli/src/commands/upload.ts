import { openAsBlob } from 'node:fs';
import { glob, stat } from 'node:fs/promises';
import path from 'node:path';
import { EdgeStoreUploadCleanupError } from '@edgestore/sdk';
import { renderCliCommand } from '../core/command';
import { CliError, normalizeError, usageError } from '../core/errors';
import type { CliRuntime, CliSdk, GlobalFlags } from '../core/runtime';
import { isInteractive, outputFor, sdkFor } from '../core/runtime';
import {
  createUploadProgressDisplay,
  type UploadProgressDisplay,
} from '../core/uploadProgress';
import { resolvedProjectRef } from './project';

const FILE_UPLOAD_CONCURRENCY = 3;

type CompletedUpload = Awaited<
  ReturnType<CliSdk['management']['uploads']['upload']>
> & { localPath: string };

type UploadOutcome =
  | { status: 'completed'; result: CompletedUpload }
  | { status: 'failed'; localPath: string; cause: CliError };

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
  if (input.path) {
    validateRemotePath(input.path);
    if (input.keepName && !input.path.endsWith('/')) {
      throw usageError(
        'upload_path_keep_name_conflict',
        '--keep-name cannot be used with an exact --path.',
        [
          'Use a folder path ending in / to preserve the original file name, or omit --keep-name to use the exact destination.',
        ],
      );
    }
  }
  const localFiles = await expandFiles(runtime.cwd, input.paths);
  if (!localFiles.length) {
    throw usageError('upload_files_missing', 'No matching files were found.');
  }
  if (localFiles.length > 1 && input.path && !input.path.endsWith('/')) {
    throw usageError(
      'upload_path_not_folder',
      '--path must end in / when uploading multiple files.',
    );
  }
  validateUniqueUploadDestinations(localFiles, {
    destinationPath: input.path,
    keepName: input.keepName,
  });

  const project = await resolvedProjectRef(runtime, flags, input.project);
  const sdk = await sdkFor(runtime, flags);
  const progressDisplay = createUploadProgressDisplay(runtime, flags);
  let outcomes: (UploadOutcome | undefined)[];
  try {
    const upload = async (
      localFile: string,
      index: number,
    ): Promise<UploadOutcome> => {
      try {
        return {
          status: 'completed',
          result: await uploadLocalFile({
            runtime,
            flags,
            sdk,
            progressDisplay,
            index,
            localFile,
            project,
            bucket: input.bucket,
            destinationPath: input.path,
            keepName: input.keepName,
          }),
        };
      } catch (error) {
        return {
          status: 'failed',
          localPath: localFile,
          cause: normalizeError(error),
        };
      }
    };
    outcomes =
      localFiles.length === 1
        ? [await upload(localFiles[0]!, 0)]
        : await mapConcurrent(localFiles, upload, {
            concurrency: FILE_UPLOAD_CONCURRENCY,
            signal: runtime.signal,
          });
  } finally {
    progressDisplay?.close();
  }

  const results = outcomes.flatMap((outcome) =>
    outcome?.status === 'completed' ? [outcome.result] : [],
  );
  const failures = outcomes.flatMap((outcome) =>
    outcome?.status === 'failed' ? [outcome] : [],
  );
  const notAttemptedPaths = localFiles.filter((_, index) => !outcomes[index]);
  if (failures.length || notAttemptedPaths.length) {
    if (localFiles.length === 1 && failures[0]) throw failures[0].cause;
    if (runtime.signal.aborted && !failures.length) throw interruptedError();
    throw batchUploadError({ results, failures, notAttemptedPaths });
  }

  const human = results
    .map((result) => {
      const readUrl = result.signedReadUrl?.signedUrl ?? result.file.url;
      return `${path.basename(result.localPath)} -> ${readUrl} (${result.file.id})`;
    })
    .join('\n');
  outputFor(runtime, flags).result({ uploads: results }, human);
}

async function uploadLocalFile(input: {
  runtime: CliRuntime;
  flags: GlobalFlags;
  sdk: CliSdk;
  progressDisplay?: UploadProgressDisplay;
  index: number;
  localFile: string;
  project: string;
  bucket: string;
  destinationPath?: string;
  keepName?: boolean;
}): Promise<CompletedUpload> {
  const { progressDisplay } = input;
  const fileName = path.basename(input.localFile);
  const mimeType = mimeTypeFor(fileName);
  const destination = resolveUploadDestination(input.destinationPath, {
    fileName,
    keepName: input.keepName,
  });
  const source = await openAsBlob(
    input.localFile,
    mimeType ? { type: mimeType } : undefined,
  );
  progressDisplay?.start(input.index, fileName, source.size);
  try {
    const completed = await input.sdk.management.uploads.upload({
      project: input.project,
      bucket: input.bucket,
      source,
      signedReadUrl: {},
      ...(destination.fileName ? { fileName: destination.fileName } : {}),
      ...(destination.path ? { path: destination.path } : {}),
      mimeType,
      signal: input.runtime.signal,
      ...(progressDisplay
        ? {
            onProgress: (progress) =>
              progressDisplay.update(input.index, progress),
          }
        : {}),
    });
    progressDisplay?.succeed(input.index);
    return { localPath: input.localFile, ...completed };
  } catch (error) {
    progressDisplay?.fail(input.index, input.runtime.signal.aborted);
    throw normalizeUploadError(error, {
      runtime: input.runtime,
      flags: input.flags,
      project: input.project,
    });
  }
}

async function mapConcurrent<TValue, TResult>(
  values: TValue[],
  mapper: (value: TValue, index: number) => Promise<TResult>,
  options: { concurrency: number; signal: AbortSignal },
): Promise<(TResult | undefined)[]> {
  const results: (TResult | undefined)[] = Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(options.concurrency, values.length) },
    async () => {
      while (!options.signal.aborted) {
        const index = nextIndex++;
        if (index >= values.length) return;
        results[index] = await mapper(values[index]!, index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function batchUploadError(input: {
  results: CompletedUpload[];
  failures: Extract<UploadOutcome, { status: 'failed' }>[];
  notAttemptedPaths: string[];
}): CliError {
  const firstFailure = input.failures[0]?.cause;
  const suggestions = Array.from(
    new Set(
      input.failures.flatMap(
        (failure) => failure.cause.options.suggestions ?? [],
      ),
    ),
  );
  const lines = [
    `Upload batch finished with ${input.failures.length} failure${input.failures.length === 1 ? '' : 's'}.`,
    `Completed (${input.results.length}):`,
    ...input.results.map(
      (result) =>
        `  ${result.localPath} -> ${result.signedReadUrl?.signedUrl ?? result.file.url} (${result.file.id})`,
    ),
    `Failed (${input.failures.length}):`,
    ...input.failures.map(
      (failure) => `  ${failure.localPath}: ${failure.cause.message}`,
    ),
    ...(input.notAttemptedPaths.length
      ? [
          `Not attempted (${input.notAttemptedPaths.length}):`,
          ...input.notAttemptedPaths.map((file) => `  ${file}`),
        ]
      : []),
  ];
  return new CliError('file_upload_incomplete', lines.join('\n'), {
    details: {
      completed: input.results,
      failures: input.failures.map((failure) => ({
        localPath: failure.localPath,
        cause: errorDetails(failure.cause),
      })),
      notAttemptedPaths: input.notAttemptedPaths,
    },
    requestId: firstFailure?.options.requestId,
    ...(suggestions.length ? { suggestions } : {}),
    exitCode: firstFailure?.exitCode,
  });
}

function validateUniqueUploadDestinations(
  localFiles: string[],
  options: { destinationPath?: string; keepName?: boolean },
): void {
  const filesByDestination = new Map<string, string[]>();
  for (const localFile of localFiles) {
    const destination = resolveUploadDestination(options.destinationPath, {
      fileName: path.basename(localFile),
      keepName: options.keepName,
    });
    if (!destination.fileName) continue;
    const remotePath = path.posix.join(
      destination.path ?? '',
      destination.fileName,
    );
    const files = filesByDestination.get(remotePath) ?? [];
    files.push(localFile);
    filesByDestination.set(remotePath, files);
  }

  const conflicts = [...filesByDestination.entries()].filter(
    ([, files]) => files.length > 1,
  );
  if (!conflicts.length) return;

  throw usageError(
    'upload_destination_conflict',
    [
      'Multiple files resolve to the same upload destination:',
      ...conflicts.flatMap(([remotePath, files]) => [
        `  ${remotePath}`,
        ...files.map((file) => `    ${file}`),
      ]),
    ].join('\n'),
    [
      'Rename the local files so each destination is unique.',
      'Omit --keep-name to let EdgeStore generate unique file names.',
    ],
  );
}

function resolveUploadDestination(
  destinationPath: string | undefined,
  input: { fileName: string; keepName?: boolean },
): { path?: string; fileName?: string } {
  if (!destinationPath) {
    return input.keepName ? { fileName: input.fileName } : {};
  }
  if (destinationPath.endsWith('/')) {
    return {
      path: destinationPath,
      ...(input.keepName ? { fileName: input.fileName } : {}),
    };
  }

  const directory = path.posix.dirname(destinationPath);
  return {
    ...(directory === '.' ? {} : { path: directory }),
    fileName: path.posix.basename(destinationPath),
  };
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

export async function fileUploadStatusCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { uploadId: string; project?: string },
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.uploads.get({
    project: await resolvedProjectRef(runtime, flags, input.project),
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
  const project = await resolvedProjectRef(runtime, flags, input.project);
  if (!input.yes) {
    if (!isInteractive(runtime, flags)) {
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
