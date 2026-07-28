import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import { resolvedProjectRef } from './project';

type FileRef =
  { id: string } | { url: string } | { bucketName: string; path: string };

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
  const project = await resolvedProjectRef(runtime, input.project);
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
    project: await resolvedProjectRef(runtime, input.project),
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
  const result = await sdk.management.files.createDownloadUrls({
    project: await resolvedProjectRef(runtime, input.project),
    files: [fileReference(input.reference, input.bucket)],
    signal: runtime.signal,
  });
  const download = result.downloadUrls[0];
  if (!download) {
    throw usageError('download_url_missing', 'No download URL was returned.');
  }
  const response = await fetch(download.url, { signal: runtime.signal });
  if (!response.ok) {
    throw new Error(`Download failed with HTTP ${response.status}.`);
  }
  const outputPath = path.resolve(runtime.cwd, input.output);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()), {
    mode: 0o600,
  });
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
  if (!input.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
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
  const project = await resolvedProjectRef(runtime, input.project);
  const sdk = await sdkFor(runtime, flags);
  const refs = input.references.map((value) =>
    fileReference(value, input.bucket),
  );
  const results = [];
  for (let index = 0; index < refs.length; index += 100) {
    const result = await sdk.management.files.delete({
      project,
      files: refs.slice(index, index + 100),
      signal: runtime.signal,
    });
    results.push(...result.results);
  }
  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;
  outputFor(runtime, flags).result(
    { results, successCount, failureCount },
    `Deleted ${successCount} file(s); ${failureCount} failed.`,
  );
  if (failureCount) runtime.exitCode = 1;
}

function fileReference(value: string, bucket?: string): FileRef {
  if (/^https?:\/\//i.test(value)) return { url: value };
  if (bucket) return { bucketName: bucket, path: value };
  return { id: value };
}
