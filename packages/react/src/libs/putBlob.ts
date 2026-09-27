import EdgeStoreClientError from './errors/EdgeStoreClientError';
import { UploadAbortedError } from './errors/uploadAbortedError';

/** A transient failure: network errors, throttling, and server errors. */
export class RetryableUploadError extends EdgeStoreClientError {}

/** Storage rejected the signed URL, usually because it expired. */
export class RejectedUploadUrlError extends EdgeStoreClientError {}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function uploadError(request: XMLHttpRequest) {
  const message = `Error uploading file (HTTP ${request.status})`;
  if (request.status === 403) return new RejectedUploadUrlError(message);
  if (RETRYABLE_STATUSES.has(request.status) || isS3RequestTimeout(request)) {
    return new RetryableUploadError(message);
  }
  return new EdgeStoreClientError(message);
}

/** S3 reports idle socket timeouts as HTTP 400 with a `RequestTimeout` code. */
function isS3RequestTimeout(request: XMLHttpRequest) {
  return (
    request.status === 400 &&
    request.responseXML?.querySelector('Error > Code')?.textContent?.trim() ===
      'RequestTimeout'
  );
}

/**
 * PUTs a blob to a signed storage URL and resolves with the response ETag.
 * `onProgress` receives the number of bytes sent so far.
 */
export function putBlob({
  blob,
  url,
  headers,
  signal,
  onProgress,
}: {
  blob: Blob;
  url: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  onProgress?: (loadedBytes: number) => void;
}) {
  return new Promise<string | null>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError('File upload aborted'));
      return;
    }

    const request = new XMLHttpRequest();
    request.open('PUT', url);
    for (const [name, value] of Object.entries(headers ?? {})) {
      request.setRequestHeader(name, value);
    }
    request.addEventListener('loadstart', () => onProgress?.(0));
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded);
    });
    request.addEventListener('load', () => {
      // `error` is not fired for HTTP errors, so check the status here.
      if (request.status >= 200 && request.status < 300) {
        resolve(request.getResponseHeader('ETag'));
      } else {
        reject(uploadError(request));
      }
    });
    request.addEventListener('error', () => {
      reject(new RetryableUploadError('Error uploading file'));
    });
    request.addEventListener('abort', () => {
      reject(new UploadAbortedError('File upload aborted'));
    });

    if (signal) {
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      request.addEventListener(
        'loadend',
        () => signal.removeEventListener('abort', abort),
        { once: true },
      );
    }

    request.send(blob);
  });
}
