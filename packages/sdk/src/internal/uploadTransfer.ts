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
    requireETag?: boolean;
  },
): Promise<string | undefined> {
  try {
    return await retry(
      async (signal) => {
        const response = await transport.fetch(options.url, {
          method: 'PUT',
          body: options.body,
          signal,
        });

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
            : !(error instanceof EdgeStoreUploadError),
        getRetryDelayMs: (error) =>
          error instanceof SignedUploadResponseError
            ? error.retryAfterMs
            : undefined,
      },
    );
  } catch (error) {
    if (error instanceof EdgeStoreAbortError) throw error;
    if (error instanceof EdgeStoreUploadError) throw error;
    if (error instanceof SignedUploadResponseError) {
      throw new EdgeStoreUploadError(error.message, options.uploadId);
    }
    throw new EdgeStoreNetworkError(
      'The signed upload could not be completed.',
      { cause: error },
    );
  }
}

async function cancelResponseBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!body) return;
  await body.cancel().catch(() => undefined);
}
