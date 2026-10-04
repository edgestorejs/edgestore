import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { CliError, normalizeError, usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { isInteractive, outputFor, sdkFor } from '../core/runtime';
import { resolvedProjectRef } from './project';

type FileRef =
  | { id: string }
  | { key: string }
  | { url: string }
  | { bucketName: string; path: string };

export async function fileListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    bucket: string;
    project?: string;
    limit?: number;
    cursor?: string;
    all?: boolean;
  },
): Promise<void> {
  if (input.all && input.cursor) {
    throw usageError(
      'conflicting_pagination',
      '--all and --cursor cannot be used together.',
    );
  }
  const project = await resolvedProjectRef(runtime, flags, input.project);
  const sdk = await sdkFor(runtime, flags);
  const files = [];
  let cursor = input.cursor;
  let pagination;
  do {
    const result = await sdk.management.files.list({
      project,
      bucket: input.bucket,
      limit: input.limit,
      cursor,
      signal: runtime.signal,
    });
    files.push(...result.files);
    pagination = result.pagination;
    cursor = result.pagination.nextCursor ?? undefined;
  } while (input.all && pagination.hasMore && cursor);

  const rows = files.map((file) => [
    file.id,
    file.key,
    file.sizeBytes,
    file.mimeType ?? '',
    file.uploadedAt,
  ]);
  const continuation =
    !input.all && pagination?.nextCursor
      ? `\n\nNext cursor: ${pagination.nextCursor}`
      : '';
  outputFor(runtime, flags).result(
    { files, pagination },
    `${
      rows.length
        ? renderTable(['ID', 'PATH', 'BYTES', 'TYPE', 'UPLOADED'], rows)
        : 'No files found.'
    }${continuation}`,
  );
}

export async function fileInfoCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { reference: string; bucket?: string; project?: string },
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.files.lookup({
    project: await resolvedProjectRef(runtime, flags, input.project),
    file: fileReference(input.reference, input.bucket),
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    [
      `ID: ${result.file.id}`,
      `Bucket: ${result.file.bucketName}`,
      `Key: ${result.file.key}`,
      `Path fields: ${JSON.stringify(result.file.path)}`,
      `Size: ${result.file.sizeBytes} bytes`,
      `Type: ${result.file.mimeType ?? 'unknown'}`,
      `URL: ${result.file.url}`,
      `Uploaded: ${result.file.uploadedAt}`,
    ].join('\n'),
    result.file.id,
  );
}

export async function fileDownloadCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    reference: string;
    output: string;
    bucket?: string;
    project?: string;
  },
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.files.generateAccessUrls({
    project: await resolvedProjectRef(runtime, flags, input.project),
    files: [fileReference(input.reference, input.bucket)],
    signal: runtime.signal,
  });
  const download = result.accessUrls[0];
  if (!download) {
    throw usageError('download_url_missing', 'No download URL was returned.');
  }
  const response = await fetch(download.url, { signal: runtime.signal });
  if (!response.ok) {
    throw new CliError(
      'download_failed',
      `Download failed with HTTP ${response.status}.`,
    );
  }
  if (!response.body) {
    throw new CliError(
      'download_body_missing',
      'The download response did not contain a body.',
    );
  }
  const outputPath = path.resolve(runtime.cwd, input.output);
  const temporaryPath = `${outputPath}.${randomUUID()}.tmp`;
  try {
    await pipeline(
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
      createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }),
      { signal: runtime.signal },
    );
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
  outputFor(runtime, flags).result(
    { output: outputPath, download },
    `Downloaded file to ${outputPath}.`,
    outputPath,
  );
}

export async function fileDeleteCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    references: string[];
    bucket?: string;
    project?: string;
    yes?: boolean;
  },
): Promise<void> {
  if (flags.plain) {
    throw usageError(
      'plain_output_unavailable',
      'File deletion does not have a single plain-text result.',
      ['Use --json to inspect every file result.'],
    );
  }
  if (!input.yes) {
    if (!isInteractive(runtime, flags)) {
      throw usageError(
        'confirmation_required',
        'File deletion requires confirmation.',
        ['Repeat the command with --yes.'],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type delete to remove ${input.references.length} file(s)`,
      'delete',
    );
  }
  const project = await resolvedProjectRef(runtime, flags, input.project);
  const sdk = await sdkFor(runtime, flags);
  const refs = input.references.map((value) =>
    fileReference(value, input.bucket),
  );
  const results = [];
  for (let index = 0; index < refs.length; index += 100) {
    try {
      const result = await sdk.management.files.delete({
        project,
        files: refs.slice(index, index + 100),
        signal: runtime.signal,
      });
      results.push(...result.results);
    } catch (error) {
      const cause = normalizeError(error);
      const successCount = results.filter((result) => result.success).length;
      const failureCount = results.length - successCount;
      const uncertainReferences = input.references.slice(index, index + 100);
      const notAttemptedReferences = input.references.slice(index + 100);
      throw new CliError(
        'file_delete_incomplete',
        renderIncompleteDeletion({
          results,
          successCount,
          failureCount,
          uncertainReferences,
          notAttemptedReferences,
          cause,
        }),
        {
          details: {
            completed: { results, successCount, failureCount },
            uncertainReferences,
            notAttemptedReferences,
            cause: {
              code: cause.code,
              message: cause.message,
              ...(cause.options.details === undefined
                ? {}
                : { details: cause.options.details }),
            },
          },
          requestId: cause.options.requestId,
          exitCode: cause.exitCode,
        },
      );
    }
  }
  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;
  const human = [
    `Deleted ${successCount} file(s); ${failureCount} failed.`,
    ...results
      .filter((result) => !result.success)
      .map(
        (result) =>
          `  ${fileReferenceLabel(result.fileRef)}: ${result.error.message}`,
      ),
  ].join('\n');
  outputFor(runtime, flags).result(
    { results, successCount, failureCount },
    human,
  );
  if (failureCount) runtime.exitCode = 1;
}

function renderIncompleteDeletion(input: {
  results: {
    fileRef: FileRef;
    success: boolean;
    error?: { message: string };
  }[];
  successCount: number;
  failureCount: number;
  uncertainReferences: string[];
  notAttemptedReferences: string[];
  cause: CliError;
}): string {
  return [
    `File deletion stopped: ${input.cause.message}`,
    `Completed: ${input.successCount} succeeded, ${input.failureCount} failed.`,
    ...input.results.map(
      (result) =>
        `  ${JSON.stringify(result.fileRef)}: ${result.success ? 'deleted' : `failed: ${result.error?.message ?? 'unknown failure'}`}`,
    ),
    `Uncertain (${input.uncertainReferences.length}):`,
    ...input.uncertainReferences.map((reference) => `  ${reference}`),
    `Not attempted (${input.notAttemptedReferences.length}):`,
    ...input.notAttemptedReferences.map((reference) => `  ${reference}`),
  ].join('\n');
}

function fileReference(value: string, bucket?: string): FileRef {
  if (bucket) return { bucketName: bucket, path: value };
  if (/^https?:\/\//i.test(value)) return { url: value };
  return { id: value };
}

function fileReferenceLabel(reference: FileRef): string {
  if ('id' in reference) return reference.id;
  if ('key' in reference) return reference.key;
  if ('url' in reference) return reference.url;
  return `${reference.bucketName}/${reference.path}`;
}
