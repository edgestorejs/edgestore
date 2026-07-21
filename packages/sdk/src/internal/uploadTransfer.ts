import {
  EdgeStoreAbortError,
  EdgeStoreApiError,
  EdgeStoreNetworkError,
  EdgeStoreUploadError,
} from '../errors';
import {
  DEFAULT_UPLOAD_MAX_ATTEMPTS,
  type RuntimeUploadInput,
} from '../uploadTypes';
import type { Transport } from './transport';

export async function uploadParts(
  transport: Transport,
  options: {
    body: Blob;
    uploadId: string;
    parts: { partNumber: number; signedUrl: string }[];
    partSizeBytes: number;
    concurrency: number;
    signal?: AbortSignal;
    retry?: RuntimeUploadInput['retry'];
    onProgress?: RuntimeUploadInput['onProgress'];
  },
): Promise<{ partNumber: number; eTag: string }[]> {
  const completed: { partNumber: number; eTag: string }[] = Array(
    options.parts.length,
  );
  let nextIndex = 0;
  let transferredBytes = 0;
  const workerCount = Math.min(options.concurrency, options.parts.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
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
          signal: options.signal,
          retry: options.retry,
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
              : Math.round((transferredBytes / options.body.size) * 10_000) /
                100,
          phase: 'transfer',
        });
      }
    }),
  );

  return completed;
}

export async function putWithRetry(
  transport: Transport,
  options: {
    url: string;
    body: Blob;
    uploadId: string;
    signal?: AbortSignal;
    retry?: RuntimeUploadInput['retry'];
  },
): Promise<Response> {
  const maxAttempts = getPositiveInteger(
    options.retry?.maxAttempts,
    DEFAULT_UPLOAD_MAX_ATTEMPTS,
    'retry.maxAttempts',
  );
  const baseDelayMs = options.retry?.baseDelayMs ?? 250;
  assertNonNegative(baseDelayMs, 'retry.baseDelayMs');
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted(options.signal);
    try {
      const response = await transport.fetch(options.url, {
        method: 'PUT',
        body: options.body,
        signal: options.signal,
      });
      if (response.ok) return response;
      if (!isRetryableStatus(response.status) || attempt === maxAttempts) {
        throw new EdgeStoreUploadError(
          `Signed upload failed with status ${response.status}.`,
          options.uploadId,
        );
      }
      await sleep(
        getRetryDelay(response, baseDelayMs, attempt),
        options.signal,
      );
    } catch (error) {
      if (error instanceof EdgeStoreAbortError || isAbortError(error)) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      if (error instanceof EdgeStoreUploadError) throw error;
      lastError = error;
      if (attempt === maxAttempts) break;
      await sleep(baseDelayMs * 2 ** (attempt - 1), options.signal);
    }
  }

  throw new EdgeStoreNetworkError('The signed upload could not be completed.', {
    cause: lastError,
  });
}

export async function retryOperation<TResult>(
  operation: () => Promise<TResult>,
  retry: RuntimeUploadInput['retry'],
  signal?: AbortSignal,
): Promise<TResult> {
  const maxAttempts = getPositiveInteger(
    retry?.maxAttempts,
    DEFAULT_UPLOAD_MAX_ATTEMPTS,
    'retry.maxAttempts',
  );
  const baseDelayMs = retry?.baseDelayMs ?? 250;
  assertNonNegative(baseDelayMs, 'retry.baseDelayMs');

  for (let attempt = 1; ; attempt++) {
    throwIfAborted(signal);
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EdgeStoreAbortError || isAbortError(error)) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      if (attempt >= maxAttempts || !isRetryableError(error)) throw error;
      const delayMs =
        error instanceof EdgeStoreApiError &&
        error.retryAfterSeconds !== undefined
          ? error.retryAfterSeconds * 1000
          : baseDelayMs * 2 ** (attempt - 1);
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
  return getRetryAfterMs(response) ?? baseDelayMs * 2 ** (attempt - 1);
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
