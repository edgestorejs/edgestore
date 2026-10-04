import { DEFAULT_MULTIPART_CONCURRENCY } from '@edgestore/sdk';
import type {
  AnyContext,
  BackendUploadParams,
  EdgeStoreRouter,
} from '@edgestore/shared';

/** Validates a signed URL lifetime against the storage service's maximum. */
export function signedUrlLifetime(
  providerName: string,
  value: number,
  maxSeconds = 604800,
) {
  if (!Number.isInteger(value) || value < 1 || value > maxSeconds) {
    throw new RangeError(
      `${providerName} signed URL expiration must be an integer between 1 and ${maxSeconds} seconds.`,
    );
  }
  return value;
}

/**
 * Direct-storage providers authorize private reads with backend-issued signed
 * URLs. Cookie-based rules would silently not be enforced, so reject them.
 */
export function assertSignedUrlAccessControl<TCtx extends AnyContext>(
  providerName: string,
  router: EdgeStoreRouter<TCtx>,
) {
  for (const bucket of Object.values(router.buckets)) {
    const { accessControl } = bucket._def;
    if (accessControl !== undefined && accessControl !== 'private') {
      throw new Error(
        `${providerName} supports accessControl("private") with backend signed URLs, not cookie-based access-control rules.`,
      );
    }
  }
}

/** Reports cumulative backend upload progress. */
export function createProgress(
  totalBytes: number,
  onProgress: BackendUploadParams['onProgress'],
) {
  let transferredBytes = 0;
  const report = (bytes: number) => {
    transferredBytes += bytes;
    onProgress?.({
      transferredBytes,
      totalBytes,
      percentage: totalBytes ? (transferredBytes / totalBytes) * 100 : 100,
      phase: 'uploading',
    });
  };
  report(0);
  return report;
}

/**
 * Runs tasks a few at a time to bound memory use. The first failure, or
 * the caller's signal, stops the remaining parts before the error is thrown.
 */
export async function runConcurrently<TItem, TResult>(
  items: TItem[],
  signal: AbortSignal | undefined,
  task: (item: TItem, signal: AbortSignal) => Promise<TResult>,
) {
  const controller = new AbortController();
  const partSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
  const results = new Array<TResult>(items.length);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(DEFAULT_MULTIPART_CONCURRENCY, items.length) },
    async () => {
      while (next < items.length) {
        partSignal.throwIfAborted();
        const index = next++;
        results[index] = await task(items[index]!, partSignal);
      }
    },
  );
  try {
    await Promise.all(workers);
  } catch (error) {
    controller.abort(error);
    await Promise.allSettled(workers);
    throw signal?.aborted ? signal.reason : error;
  }
  signal?.throwIfAborted();
  return results;
}

/** Reads one part of the source into memory. */
export async function readPart(
  source: Blob,
  partNumber: number,
  partSizeBytes: number,
) {
  const start = (partNumber - 1) * partSizeBytes;
  return new Uint8Array(
    await source.slice(start, start + partSizeBytes).arrayBuffer(),
  );
}
