import {
  type SharedRequestUploadPartsRes,
  type SharedRequestUploadRes,
} from '@edgestore/shared';
import EdgeStoreClientError from './libs/errors/EdgeStoreClientError';
import { handleError } from './libs/errors/handleError';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';
import {
  isRetryableStatus,
  putBlob,
  RejectedUploadUrlError,
  RetryableUploadError,
} from './libs/putBlob';

type MultipartInfo = Extract<
  SharedRequestUploadRes,
  { multipart: unknown }
>['multipart'];

type MultipartSession = {
  bucketName: string;
  uploadId: string;
  key: string;
};

const CONCURRENCY = 5;
const MAX_RETRIES = 10;
const PART_URL_BATCH_SIZE = 10;
const CLEANUP_TIMEOUT_MS = 5000;

/**
 * Uploads the parts of a multipart session and completes it. Part URLs are
 * requested in batches as workers reach them, and a rejected URL is refreshed
 * once. On failure or cancellation, the session is aborted on a best-effort
 * basis; bucket lifecycle rules must cover uploads that are never cleaned up.
 */
export async function multipartUpload({
  apiPath,
  bucketName,
  multipart,
  file,
  signal,
  onProgressChange,
}: {
  apiPath: string;
  bucketName: string;
  multipart: MultipartInfo;
  file: Blob;
  signal?: AbortSignal;
  onProgressChange?: (progress: number) => void;
}) {
  const { uploadId, key, partSize, totalParts } = multipart;
  const session: MultipartSession = { bucketName, uploadId, key };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();

  const partUrls = createPartUrls({
    apiPath,
    session,
    totalParts,
    initialParts: multipart.parts,
    signal: controller.signal,
  });
  const loadedBytes = new Array<number>(totalParts).fill(0);
  const reportProgress = () => {
    const loaded = loadedBytes.reduce((sum, bytes) => sum + bytes, 0);
    onProgressChange?.(Math.round((loaded / (file.size || 1)) * 10000) / 100);
  };

  const uploadPart = async (index: number) => {
    const partNumber = index + 1;
    const chunk = file.slice(index * partSize, partNumber * partSize);
    let retries = 0;
    let refreshUrl = false;
    let urlRefreshed = false;
    for (;;) {
      throwIfAborted(controller.signal);
      try {
        const eTag = await putBlob({
          blob: chunk,
          url: await partUrls.get(partNumber, refreshUrl),
          signal: controller.signal,
          onProgress: (bytes) => {
            loadedBytes[index] = bytes;
            reportProgress();
          },
        });
        if (!eTag) {
          throw new EdgeStoreClientError(
            'Could not get ETag from multipart response. Check that the storage CORS configuration exposes the ETag header.',
          );
        }
        loadedBytes[index] = chunk.size;
        reportProgress();
        return { partNumber, eTag };
      } catch (error) {
        refreshUrl = false;
        if (controller.signal.aborted) throw error;
        if (error instanceof RejectedUploadUrlError && !urlRefreshed) {
          refreshUrl = urlRefreshed = true;
          continue;
        }
        if (!(error instanceof RetryableUploadError) || retries >= MAX_RETRIES)
          throw error;
        await wait(backoffMs(retries++), controller.signal);
      }
    }
  };

  try {
    const parts = await runWorkers(totalParts, controller, uploadPart);
    await postJson(`${apiPath}/complete-multipart-upload`, {
      body: { ...session, parts },
      signal: controller.signal,
    });
  } catch (error) {
    await abortSession(apiPath, session);
    throw signal?.aborted
      ? new UploadAbortedError('File upload aborted')
      : error;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

function createPartUrls({
  apiPath,
  session,
  totalParts,
  initialParts,
  signal,
}: {
  apiPath: string;
  session: MultipartSession;
  totalParts: number;
  initialParts: MultipartInfo['parts'];
  signal: AbortSignal;
}) {
  const urls = new Map<number, Promise<string>>(
    initialParts.map((part) => [
      part.partNumber,
      Promise.resolve(part.uploadUrl),
    ]),
  );

  const requestBatch = (partNumbers: number[]) => {
    const batch = postJson(`${apiPath}/request-upload-parts`, {
      body: { ...session, parts: partNumbers },
      signal,
      retryTransientErrors: true,
    })
      .then((res) => res.json() as Promise<SharedRequestUploadPartsRes>)
      .then(
        (res) =>
          new Map(res.parts.map((part) => [part.partNumber, part.uploadUrl])),
      );
    for (const partNumber of partNumbers) {
      const url = batch.then((received) => {
        const uploadUrl = received.get(partNumber);
        if (!uploadUrl) {
          throw new EdgeStoreClientError(
            `Missing upload URL for part ${partNumber}.`,
          );
        }
        return uploadUrl;
      });
      // Forget failed requests so the next caller asks again.
      url.catch(() => {
        if (urls.get(partNumber) === url) urls.delete(partNumber);
      });
      urls.set(partNumber, url);
    }
  };

  return {
    get(partNumber: number, refresh: boolean) {
      if (refresh) urls.delete(partNumber);
      if (!urls.has(partNumber)) {
        const batch = [partNumber];
        for (
          let next = partNumber + 1;
          next <= totalParts && batch.length < PART_URL_BATCH_SIZE;
          next++
        ) {
          if (!urls.has(next)) batch.push(next);
        }
        requestBatch(batch);
      }
      return urls.get(partNumber)!;
    },
  };
}

/** Runs tasks with bounded concurrency and stops the rest after a failure. */
async function runWorkers<TResult>(
  count: number,
  controller: AbortController,
  task: (index: number) => Promise<TResult>,
) {
  const results = new Array<TResult>(count);
  let next = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, count) },
    async () => {
      while (next < count) {
        throwIfAborted(controller.signal);
        const index = next++;
        results[index] = await task(index);
      }
    },
  );
  try {
    await Promise.all(workers);
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    throw error;
  }
  throwIfAborted(controller.signal);
  return results;
}

async function abortSession(apiPath: string, session: MultipartSession) {
  // The transfer signal may already be aborted, so cleanup gets its own deadline.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLEANUP_TIMEOUT_MS);
  try {
    await postJson(`${apiPath}/abort-multipart-upload`, {
      body: session,
      signal: controller.signal,
    });
  } catch {
    // Best effort: the original failure is more useful to the caller.
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POSTs to the EdgeStore API. With `retryTransientErrors`, throttling and
 * server errors become `RetryableUploadError`s for the part retry loop.
 */
async function postJson(
  url: string,
  {
    body,
    signal,
    retryTransientErrors = false,
  }: { body: unknown; signal: AbortSignal; retryTransientErrors?: boolean },
) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      signal,
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw new UploadAbortedError('File upload aborted');
    throw new RetryableUploadError(
      error instanceof Error ? error.message : 'Network request failed',
    );
  }
  if (!res.ok && retryTransientErrors && isRetryableStatus(res.status)) {
    throw new RetryableUploadError(`Request failed (HTTP ${res.status})`);
  }
  if (!res.ok) await handleError(res);
  return res;
}

function backoffMs(retry: number) {
  const base = Math.min(30_000, 1000 * 2 ** retry);
  return base / 2 + Math.random() * (base / 2);
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new UploadAbortedError('File upload aborted');
}
