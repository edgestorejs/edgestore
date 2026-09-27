import { EdgeStoreUploadError } from '../errors';
import type { RuntimeUploadInput } from '../uploadTypes';
import { createSizedStreamReader } from './sizedStreamReader';
import type { Transport } from './transport';
import { throwIfAborted } from './uploadRetry';
import { putWithRetry } from './uploadTransfer';

export type CompletedUploadPart = { partNumber: number; eTag: string };
export type SignedUploadPart = { partNumber: number; signedUrl: string };
type ProgressHandler = RuntimeUploadInput['onProgress'];

export async function uploadParts(
  transport: Transport,
  options: {
    body: Blob;
    uploadId: string;
    parts: SignedUploadPart[];
    partSizeBytes: number;
    concurrency: number;
    signal?: AbortSignal;
    onProgress?: ProgressHandler;
  },
): Promise<CompletedUploadPart[]> {
  const completed: CompletedUploadPart[] = Array(options.parts.length);
  let nextIndex = 0;
  const transferredByPart = Array<number>(options.parts.length).fill(0);
  let transferredBytes = 0;
  const workerCount = Math.min(options.concurrency, options.parts.length);
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;

  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < options.parts.length) {
      const index = nextIndex++;
      const part = options.parts[index];
      if (!part) continue;
      const start = (part.partNumber - 1) * options.partSizeBytes;
      const chunk = options.body.slice(
        start,
        Math.min(start + options.partSizeBytes, options.body.size),
      );
      const eTag = await putWithRetry(transport, {
        uploadId: options.uploadId,
        url: part.signedUrl,
        body: chunk,
        signal,
        onProgress: options.onProgress
          ? (partBytes) => {
              const previousPartBytes = transferredByPart[index] ?? 0;
              const nextPartBytes = Math.max(previousPartBytes, partBytes);
              transferredByPart[index] = nextPartBytes;
              transferredBytes += nextPartBytes - previousPartBytes;
              reportProgress(
                options.onProgress,
                transferredBytes,
                options.body.size,
              );
            }
          : undefined,
        requireETag: true,
      });
      completed[index] = { partNumber: part.partNumber, eTag };
      const previousPartBytes = transferredByPart[index] ?? 0;
      if (previousPartBytes < chunk.size) {
        transferredByPart[index] = chunk.size;
        transferredBytes += chunk.size - previousPartBytes;
        reportProgress(options.onProgress, transferredBytes, options.body.size);
      }
    }
  });

  try {
    await Promise.all(workers);
  } catch (error) {
    controller.abort(error);
    await Promise.allSettled(workers);
    throw error;
  }

  return completed;
}

export async function uploadStreamParts(
  transport: Transport,
  options: {
    stream: ReadableStream<Uint8Array>;
    totalBytes: number;
    uploadId: string;
    parts: SignedUploadPart[];
    partSizeBytes: number;
    signal?: AbortSignal;
    onProgress?: ProgressHandler;
  },
): Promise<CompletedUploadPart[]> {
  const reader = createSizedStreamReader(options.stream);
  const completed: CompletedUploadPart[] = [];
  let transferredBytes = 0;

  try {
    for (const part of options.parts) {
      throwIfAborted(options.signal);
      const expectedBytes = Math.min(
        options.partSizeBytes,
        options.totalBytes - transferredBytes,
      );
      const chunk = await reader.read(expectedBytes, options.signal);
      if (chunk.byteLength !== expectedBytes) {
        throw new EdgeStoreUploadError(
          `Upload stream ended after ${transferredBytes + chunk.byteLength} bytes; expected ${options.totalBytes}.`,
          options.uploadId,
        );
      }
      let partTransferredBytes = 0;
      const eTag = await putWithRetry(transport, {
        uploadId: options.uploadId,
        url: part.signedUrl,
        body: new Blob([Uint8Array.from(chunk)]),
        signal: options.signal,
        onProgress: options.onProgress
          ? (partBytes) => {
              partTransferredBytes = Math.max(partTransferredBytes, partBytes);
              reportProgress(
                options.onProgress,
                transferredBytes +
                  Math.min(partTransferredBytes, chunk.byteLength),
                options.totalBytes,
              );
            }
          : undefined,
        requireETag: true,
      });
      completed.push({ partNumber: part.partNumber, eTag });
      transferredBytes += chunk.byteLength;
      if (partTransferredBytes < chunk.byteLength) {
        reportProgress(
          options.onProgress,
          transferredBytes,
          options.totalBytes,
        );
      }
    }

    if (
      transferredBytes !== options.totalBytes ||
      !(await reader.isDone(options.signal))
    ) {
      throw new EdgeStoreUploadError(
        `Upload stream exceeded its declared size of ${options.totalBytes} bytes.`,
        options.uploadId,
      );
    }
    reader.release();
    return completed;
  } catch (error) {
    reader.cancel(error);
    throw error;
  }
}

function reportProgress(
  onProgress: ProgressHandler,
  transferredBytes: number,
  totalBytes: number,
) {
  onProgress?.({
    transferredBytes,
    totalBytes,
    percentage:
      totalBytes === 0
        ? 100
        : Math.round((transferredBytes / totalBytes) * 10_000) / 100,
    phase: 'uploading',
  });
}
