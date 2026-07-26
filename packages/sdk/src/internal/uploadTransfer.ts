import {
  EdgeStoreAbortError,
  EdgeStoreApiError,
  EdgeStoreNetworkError,
  EdgeStoreUploadError,
} from '../errors';
import type { RuntimeUploadInput } from '../uploadTypes';
import type { Transport } from './transport';

const DEFAULT_UPLOAD_MAX_ATTEMPTS = 3;
const DEFAULT_UPLOAD_BASE_DELAY_MS = 250;

export async function uploadParts(
  transport: Transport,
  options: {
    body: Blob;
    uploadId: string;
    parts: { partNumber: number; signedUrl: string }[];
    partSizeBytes: number;
    concurrency: number;
    signal?: AbortSignal;
    onProgress?: RuntimeUploadInput['onProgress'];
  },
): Promise<{ partNumber: number; eTag: string }[]> {
  const completed: { partNumber: number; eTag: string }[] = Array(
    options.parts.length,
  );
  let nextIndex = 0;
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
      const response = await putWithRetry(transport, {
        uploadId: options.uploadId,
        url: part.signedUrl,
        body: chunk,
        signal,
      });
      const eTag = response.headers.get('etag');
      if (!eTag) {
        throw new EdgeStoreUploadError(
          `Upload part ${part.partNumber} did not return an ETag.`,
          options.uploadId,
        );
      }
      completed[index] = { partNumber: part.partNumber, eTag };
      transferredBytes += chunk.size;
      options.onProgress?.({
        transferredBytes,
        totalBytes: options.body.size,
        percentage:
          options.body.size === 0
            ? 100
            : Math.round((transferredBytes / options.body.size) * 10_000) / 100,
        phase: 'uploading',
      });
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
    parts: { partNumber: number; signedUrl: string }[];
    partSizeBytes: number;
    signal?: AbortSignal;
    onProgress?: RuntimeUploadInput['onProgress'];
  },
): Promise<{ partNumber: number; eTag: string }[]> {
  const reader = createSizedStreamReader(options.stream);
  const completed: { partNumber: number; eTag: string }[] = [];
  let transferredBytes = 0;

  try {
    for (const part of options.parts) {
      throwIfAborted(options.signal);
      const expectedBytes = Math.min(
        options.partSizeBytes,
        options.totalBytes - transferredBytes,
      );
      const chunk = await reader.read(expectedBytes);
      if (chunk.byteLength !== expectedBytes) {
        throw new EdgeStoreUploadError(
          `Upload stream ended after ${transferredBytes + chunk.byteLength} bytes; expected ${options.totalBytes}.`,
          options.uploadId,
        );
      }
      const response = await putWithRetry(transport, {
        uploadId: options.uploadId,
        url: part.signedUrl,
        body: new Blob([Uint8Array.from(chunk)]),
        signal: options.signal,
      });
      const eTag = response.headers.get('etag');
      if (!eTag) {
        throw new EdgeStoreUploadError(
          `Upload part ${part.partNumber} did not return an ETag.`,
          options.uploadId,
        );
      }
      completed.push({ partNumber: part.partNumber, eTag });
      transferredBytes += chunk.byteLength;
      options.onProgress?.({
        transferredBytes,
        totalBytes: options.totalBytes,
        percentage:
          options.totalBytes === 0
            ? 100
            : Math.round((transferredBytes / options.totalBytes) * 10_000) /
              100,
        phase: 'uploading',
      });
    }

    if (transferredBytes !== options.totalBytes || !(await reader.isDone())) {
      throw new EdgeStoreUploadError(
        `Upload stream exceeded its declared size of ${options.totalBytes} bytes.`,
        options.uploadId,
      );
    }
    reader.release();
    return completed;
  } catch (error) {
    await reader.cancel(error);
    throw error;
  }
}

export async function putWithRetry(
  transport: Transport,
  options: {
    url: string;
    body: Blob;
    uploadId: string;
    signal?: AbortSignal;
  },
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DEFAULT_UPLOAD_MAX_ATTEMPTS; attempt++) {
    throwIfAborted(options.signal);
    try {
      const response = await transport.fetch(options.url, {
        method: 'PUT',
        body: options.body,
        signal: options.signal,
      });
      if (response.ok) return response;
      if (
        !isRetryableStatus(response.status) ||
        attempt === DEFAULT_UPLOAD_MAX_ATTEMPTS
      ) {
        throw new EdgeStoreUploadError(
          `Signed upload failed with status ${response.status}.`,
          options.uploadId,
        );
      }
      await sleep(
        getRetryDelay(response, DEFAULT_UPLOAD_BASE_DELAY_MS, attempt),
        options.signal,
      );
    } catch (error) {
      if (error instanceof EdgeStoreAbortError || isAbortError(error)) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      if (error instanceof EdgeStoreUploadError) throw error;
      lastError = error;
      if (attempt === DEFAULT_UPLOAD_MAX_ATTEMPTS) break;
      await sleep(
        fullJitterDelay(DEFAULT_UPLOAD_BASE_DELAY_MS, attempt),
        options.signal,
      );
    }
  }

  throw new EdgeStoreNetworkError('The signed upload could not be completed.', {
    cause: lastError,
  });
}

export async function retryOperation<TResult>(
  operation: () => Promise<TResult>,
  signal?: AbortSignal,
): Promise<TResult> {
  for (let attempt = 1; ; attempt++) {
    throwIfAborted(signal);
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EdgeStoreAbortError || isAbortError(error)) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      if (attempt >= DEFAULT_UPLOAD_MAX_ATTEMPTS || !isRetryableError(error)) {
        throw error;
      }
      const delayMs =
        error instanceof EdgeStoreApiError &&
        error.retryAfterSeconds !== undefined
          ? error.retryAfterSeconds * 1000
          : fullJitterDelay(DEFAULT_UPLOAD_BASE_DELAY_MS, attempt);
      await sleep(delayMs, signal);
    }
  }
}

export function getPositiveInteger(
  value: number | undefined,
  fallback: number,
  name: string,
): number {
  const result = value ?? fallback;
  if (!Number.isInteger(result) || result <= 0) {
    throw new RangeError(`${name} must be a positive integer.`);
  }
  return result;
}

export function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative number.`);
  }
}

export function getRetryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('retry-after');
  if (value === null) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined;
}

export function sleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new EdgeStoreAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timeout);
      reject(new EdgeStoreAbortError());
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new EdgeStoreAbortError();
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelay(
  response: Response,
  baseDelayMs: number,
  attempt: number,
) {
  return getRetryAfterMs(response) ?? fullJitterDelay(baseDelayMs, attempt);
}

function fullJitterDelay(baseDelayMs: number, attempt: number) {
  return Math.random() * baseDelayMs * 2 ** (attempt - 1);
}

function isRetryableError(error: unknown): boolean {
  return (
    error instanceof EdgeStoreNetworkError ||
    (error instanceof EdgeStoreApiError && isRetryableStatus(error.status))
  );
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function createSizedStreamReader(
  stream: ReadableStream<Uint8Array<ArrayBufferLike>>,
) {
  const reader = stream.getReader();
  let remainder = new Uint8Array<ArrayBufferLike>(new ArrayBuffer(0));
  let ended = false;

  return {
    async read(size: number) {
      const chunks: Uint8Array<ArrayBufferLike>[] = [];
      let length = 0;

      while (length < size) {
        if (remainder.byteLength > 0) {
          const take = Math.min(size - length, remainder.byteLength);
          chunks.push(remainder.subarray(0, take));
          length += take;
          remainder = remainder.subarray(take);
          continue;
        }
        const next = await reader.read();
        if (next.done) {
          ended = true;
          break;
        }
        remainder = next.value;
      }

      const result = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return result;
    },
    async isDone() {
      if (remainder.byteLength > 0) return false;
      if (ended) return true;
      const next = await reader.read();
      ended = next.done;
      if (!next.done) remainder = next.value;
      return ended;
    },
    cancel(reason: unknown) {
      void reader
        .cancel(reason)
        .catch(() => undefined)
        .finally(() => {
          releaseReader(reader);
        });
      releaseReader(reader);
    },
    release() {
      reader.releaseLock();
    },
  };
}
