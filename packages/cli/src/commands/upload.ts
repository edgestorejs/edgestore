import { glob, open, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
} from '@edgestore/sdk';
import { CliError, usageError } from '../core/errors';
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
  for (const localFile of localFiles) {
    const fileStat = await stat(localFile);
    const large = fileStat.size >= DEFAULT_MULTIPART_THRESHOLD_BYTES;
    const fileName = path.basename(localFile);
    const destination =
      input.path && localFiles.length > 1
        ? `${input.path}${fileName}`
        : input.path;
    const partCount = large
      ? Math.ceil(fileStat.size / DEFAULT_MULTIPART_PART_SIZE_BYTES)
      : 0;
    const requested = await sdk.management.uploads.request({
      project,
      bucket: input.bucket,
      ...(input.keepName ? { fileName } : {}),
      ...(destination ? { path: destination } : {}),
      mimeType: mimeTypeFor(fileName),
      sizeBytes: fileStat.size,
      ...(large
        ? {
            multipart: {
              partNumbers: Array.from(
                { length: partCount },
                (_, index) => index + 1,
              ),
            },
          }
        : {}),
      signal: runtime.signal,
    });
    let transferring = true;
    try {
      if (requested.upload.kind === 'single') {
        await putPart(
          requested.upload.signedUrl,
          await readFile(localFile),
          runtime.signal,
        );
        transferring = false;
      } else {
        const handle = await open(localFile, 'r');
        const completedParts = [];
        try {
          for (const part of requested.upload.parts) {
            const offset =
              (part.partNumber - 1) * DEFAULT_MULTIPART_PART_SIZE_BYTES;
            const size = Math.min(
              DEFAULT_MULTIPART_PART_SIZE_BYTES,
              fileStat.size - offset,
            );
            const buffer = Buffer.allocUnsafe(size);
            await handle.read(buffer, 0, size, offset);
            const etag = await putPart(part.signedUrl, buffer, runtime.signal);
            completedParts.push({ partNumber: part.partNumber, eTag: etag });
            reportProgress(runtime, flags, {
              fileName,
              percentage: Math.round((completedParts.length / partCount) * 100),
            });
          }
        } finally {
          await handle.close();
        }
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
      if (transferring) {
        await sdk.management.uploads
          .cancel({
            project,
            uploadId: requested.upload.id,
            signal: runtime.signal,
          })
          .catch(() => undefined);
      }
      throw error;
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
      suggestions: [`edgestore file upload-status ${target.uploadId}`],
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
  if (!input.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Upload cancellation requires confirmation.',
        [`edgestore file upload-cancel ${input.uploadId} --yes`],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type ${input.uploadId} to cancel this upload`,
      input.uploadId,
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.uploads.cancel({
    project: await resolvedProjectRef(runtime, input.project),
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
    for await (const match of glob(pattern, { cwd })) {
      const absolute = path.resolve(cwd, match);
      if ((await stat(absolute)).isFile()) files.add(absolute);
    }
  }
  return [...files];
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
