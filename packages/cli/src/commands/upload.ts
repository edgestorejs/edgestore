import { glob, open, stat } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { planMultipartUpload } from '@edgestore/sdk';
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
      const handle = await open(localFile, 'r');
      try {
        const fileStat = await handle.stat();
        const multipartPlan = planMultipartUpload({ sizeBytes: fileStat.size });
        const fileName = path.basename(localFile);
        const destination =
          input.path && localFiles.length > 1
            ? `${input.path}${fileName}`
            : input.path;
        const requested = await sdk.management.uploads.request({
          project,
          bucket: input.bucket,
          ...(input.keepName ? { fileName } : {}),
          ...(destination ? { path: destination } : {}),
          mimeType: mimeTypeFor(fileName),
          sizeBytes: fileStat.size,
          ...(multipartPlan
            ? { multipart: { partNumbers: multipartPlan.partNumbers } }
            : {}),
          signal: runtime.signal,
        });
        let transferring = true;
        try {
          if (requested.upload.kind === 'single') {
            if (multipartPlan) {
              throw new CliError(
                'upload_plan_mismatch',
                'The API returned a single upload for a multipart request.',
              );
            }
            const buffer = Buffer.allocUnsafe(fileStat.size);
            await readExactly(handle, buffer, 0);
            await assertSourceSize(handle, fileStat.size);
            await putPart(requested.upload.signedUrl, buffer, runtime.signal);
            transferring = false;
          } else {
            if (!multipartPlan) {
              throw new CliError(
                'upload_plan_mismatch',
                'The API returned a multipart upload for a single upload request.',
              );
            }
            const completedParts = [];
            for (const part of requested.upload.parts) {
              const offset =
                (part.partNumber - 1) * multipartPlan.partSizeBytes;
              const size = Math.min(
                multipartPlan.partSizeBytes,
                fileStat.size - offset,
              );
              const buffer = Buffer.allocUnsafe(size);
              await readExactly(handle, buffer, offset);
              const etag = await putPart(
                part.signedUrl,
                buffer,
                runtime.signal,
              );
              completedParts.push({ partNumber: part.partNumber, eTag: etag });
              reportProgress(runtime, flags, {
                fileName,
                percentage: Math.round(
                  (completedParts.length / multipartPlan.totalParts) * 100,
                ),
              });
            }
            await assertSourceSize(handle, fileStat.size);
            await sdk.management.uploads.completeMultipart({
              project,
              uploadId: requested.upload.id,
              parts: completedParts,
              signal: runtime.signal,
            });
            transferring = false;
          }
          const completed = await waitForUpload(runtime, flags, {
            project,
            uploadId: requested.upload.id,
          });
          results.push({
            localPath: localFile,
            ...completed,
            signedReadUrl: requested.signedReadUrl,
          });
        } catch (error) {
          const cause = runtime.signal.aborted
            ? new CliError('interrupted', 'Operation canceled.', {
                exitCode: 130,
              })
            : normalizeError(error);
          if (!transferring) throw cause;
          try {
            await sdk.management.uploads.cancel({
              project,
              uploadId: requested.upload.id,
              signal: AbortSignal.timeout(10_000),
            });
          } catch (cleanupError) {
            const cleanup = normalizeError(cleanupError);
            throw new CliError(
              'upload_cleanup_failed',
              `${cause.message} Automatic cancellation of upload ${requested.upload.id} failed.`,
              {
                details: {
                  cause: errorDetails(cause),
                  cleanup: {
                    status: 'failed',
                    uploadId: requested.upload.id,
                    error: errorDetails(cleanup),
                  },
                },
                requestId: cause.options.requestId,
                suggestions: [
                  ...(cause.options.suggestions ?? []),
                  renderCliCommand(
                    flags,
                    ['file', 'upload-cancel', requested.upload.id, '--yes'],
                    { project },
                  ),
                ],
                exitCode: cause.exitCode,
              },
            );
          }
          throw cause;
        }
      } finally {
        await handle.close();
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

async function putPart(
  url: string,
  body: Buffer,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(url, {
    method: 'PUT',
    body: new Uint8Array(body),
    signal,
  });
  if (!response.ok) {
    throw new CliError(
      'upload_transfer_failed',
      `Storage upload failed with HTTP ${response.status}.`,
    );
  }
  return response.headers.get('etag') ?? '';
}

async function waitForUpload(
  runtime: CliRuntime,
  flags: GlobalFlags,
  target: { project: string; uploadId: string },
) {
  const sdk = await sdkFor(runtime, flags);
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await sdk.management.uploads.get({
      project: target.project,
      uploadId: target.uploadId,
      signal: runtime.signal,
    });
    if (result.upload.status === 'completed' && 'file' in result) return result;
    if (result.upload.status === 'canceled') {
      throw new CliError(
        'upload_canceled',
        `Upload ${target.uploadId} was canceled.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new CliError(
    'upload_processing_timeout',
    `Timed out waiting for upload ${target.uploadId}.`,
    {
      suggestions: [
        renderCliCommand(flags, ['file', 'upload-status', target.uploadId], {
          project: target.project,
        }),
      ],
    },
  );
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

export async function readExactly(
  handle: {
    read(
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
    ): Promise<{ bytesRead: number }>;
  },
  buffer: Buffer,
  position: number,
): Promise<void> {
  let bytesRead = 0;
  while (bytesRead < buffer.length) {
    const result = await handle.read(
      buffer,
      bytesRead,
      buffer.length - bytesRead,
      position + bytesRead,
    );
    if (result.bytesRead === 0) {
      throw new CliError(
        'upload_source_changed',
        'The upload source changed while it was being read.',
      );
    }
    bytesRead += result.bytesRead;
  }
}

async function assertSourceSize(
  handle: Pick<FileHandle, 'stat'>,
  expectedSize: number,
): Promise<void> {
  if ((await handle.stat()).size !== expectedSize) {
    throw new CliError(
      'upload_source_changed',
      'The upload source changed while it was being read.',
    );
  }
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
