import { EdgeStoreAbortError } from '../errors';
import { throwIfAborted } from './uploadRetry';

export function createSizedStreamReader(
  stream: ReadableStream<Uint8Array<ArrayBufferLike>>,
) {
  const reader = stream.getReader();
  let remainder = new Uint8Array<ArrayBufferLike>(new ArrayBuffer(0));
  let ended = false;

  return {
    async read(size: number, signal?: AbortSignal) {
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
        const next = await readWithSignal(reader, signal);
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
    async isDone(signal?: AbortSignal) {
      if (remainder.byteLength > 0) return false;
      if (ended) return true;
      const next = await readWithSignal(reader, signal);
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
      releaseReader(reader);
    },
  };
}

function readWithSignal(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
  signal?: AbortSignal,
) {
  throwIfAborted(signal);
  const pendingRead = reader.read();
  if (!signal) return pendingRead;

  return new Promise<ReadableStreamReadResult<Uint8Array<ArrayBufferLike>>>(
    (resolve, reject) => {
      let settled = false;
      const onAbort = () => {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', onAbort);
        const error = new EdgeStoreAbortError();
        void reader.cancel(error).catch(() => undefined);
        reject(error);
      };
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
      void pendingRead.then(
        (result) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener('abort', onAbort);
          reject(
            error instanceof Error
              ? error
              : new Error('Failed to read from the upload stream', {
                  cause: error,
                }),
          );
        },
      );
    },
  );
}

function releaseReader(
  reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>>,
) {
  try {
    reader.releaseLock();
  } catch {
    // A pending read releases the lock after its best-effort cancellation.
  }
}
