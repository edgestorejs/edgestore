import {
  EdgeStoreAbortError,
  EdgeStoreNetworkError,
  EdgeStoreUploadError,
} from '../errors';
import type { Transport } from './transport';
import { getRetryAfterMs, isRetryableStatus, retry } from './uploadRetry';

class SignedUploadResponseError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfterMs: number | undefined,
  ) {
    super(`Signed upload failed with status ${status}.`);
  }
}

export function putWithRetry(
  transport: Transport,
  options: {
    url: string;
    body: Blob;
    uploadId: string;
    signal?: AbortSignal;
    onProgress?: (transferredBytes: number) => void;
    requireETag: true;
  },
): Promise<string>;
export function putWithRetry(
  transport: Transport,
  options: {
    url: string;
    body: Blob;
    uploadId: string;
    signal?: AbortSignal;
    onProgress?: (transferredBytes: number) => void;
    requireETag?: false;
  },
): Promise<string | undefined>;
export async function putWithRetry(
  transport: Transport,
  options: {
    url: string;
    body: Blob;
    uploadId: string;
    signal?: AbortSignal;
    onProgress?: (transferredBytes: number) => void;
    requireETag?: boolean;
  },
): Promise<string | undefined> {
  let reportedBytes = 0;
  const onProgress = options.onProgress
    ? (transferredBytes: number) => {
        const nextBytes = Math.max(reportedBytes, transferredBytes);
        if (nextBytes === reportedBytes) return;
        reportedBytes = nextBytes;
        options.onProgress?.(reportedBytes);
      }
    : undefined;

  try {
    return await retry(
      async (signal) => {
        const response = await transport.fetch(
          options.url,
          createUploadRequest(options.body, signal, onProgress),
        );

        try {
          if (!response.ok) {
            throw new SignedUploadResponseError(
              response.status,
              getRetryAfterMs(response),
            );
          }

          const eTag = response.headers.get('etag') ?? undefined;
          if (options.requireETag && !eTag) {
            throw new EdgeStoreUploadError(
              'The signed upload did not return an ETag.',
              options.uploadId,
            );
          }
          return eTag;
        } finally {
          await cancelResponseBody(response.body);
        }
      },
      {
        signal: options.signal,
        isRetryable: (error) =>
          error instanceof SignedUploadResponseError
            ? isRetryableStatus(error.status)
            : !findBlobReadError(error) &&
              !(error instanceof EdgeStoreUploadError),
        getRetryDelayMs: (error) =>
          error instanceof SignedUploadResponseError
            ? error.retryAfterMs
            : undefined,
      },
    );
  } catch (error) {
    if (error instanceof EdgeStoreAbortError) throw error;
    if (error instanceof EdgeStoreUploadError) throw error;
    const blobReadError = findBlobReadError(error);
    if (blobReadError) throw blobReadError;
    if (error instanceof SignedUploadResponseError) {
      throw new EdgeStoreUploadError(error.message, options.uploadId);
    }
    throw new EdgeStoreNetworkError(
      'The signed upload could not be completed.',
      { cause: error },
    );
  }
}

function createUploadRequest(
  body: Blob,
  signal: AbortSignal | undefined,
  onProgress: ((transferredBytes: number) => void) | undefined,
): RequestInit {
  if (!onProgress) {
    return { method: 'PUT', body, signal };
  }

  let transferredBytes = 0;
  const stream = body.stream().pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        transferredBytes += chunk.byteLength;
        onProgress(Math.min(transferredBytes, body.size));
        controller.enqueue(chunk);
      },
    }),
  );
  const headers = new Headers({ 'content-length': String(body.size) });
  if (body.type) headers.set('content-type', body.type);

  return {
    method: 'PUT',
    body: stream,
    headers,
    signal,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' };
}

function findBlobReadError(error: unknown): DOMException | undefined {
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current)) {
    if (
      current instanceof DOMException &&
      current.name === 'NotReadableError'
    ) {
      return current;
    }
    seen.add(current);
    current = current.cause;
  }
  return undefined;
}

async function cancelResponseBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!body) return;
  await body.cancel().catch(() => undefined);
}
