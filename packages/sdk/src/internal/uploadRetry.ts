import {
  EdgeStoreAbortError,
  EdgeStoreApiError,
  EdgeStoreNetworkError,
} from '../errors';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;

type RetryOptions = {
  signal?: AbortSignal;
  deadline?: number;
  timeoutError?: () => Error;
  isRetryable: (error: unknown) => boolean;
  getRetryDelayMs?: (error: unknown) => number | undefined;
};

export async function retry<TResult>(
  operation: (signal?: AbortSignal) => Promise<TResult>,
  options: RetryOptions,
): Promise<TResult> {
  for (let attempt = 1; ; attempt++) {
    throwIfAborted(options.signal);
    const remainingMs =
      options.deadline === undefined
        ? undefined
        : options.deadline - Date.now();
    if (remainingMs !== undefined && remainingMs <= 0) {
      throw createTimeoutError(options);
    }
    const deadlineSignal =
      remainingMs === undefined
        ? undefined
        : AbortSignal.timeout(Math.max(1, Math.ceil(remainingMs)));
    const operationSignal = combineSignals(options.signal, deadlineSignal);

    try {
      return await operation(operationSignal);
    } catch (error) {
      if (
        deadlineSignal?.aborted === true ||
        (options.deadline !== undefined && Date.now() >= options.deadline)
      ) {
        throw createTimeoutError(options);
      }
      if (options.signal?.aborted) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      if (error instanceof EdgeStoreAbortError || isAbortError(error)) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      if (attempt >= DEFAULT_MAX_ATTEMPTS || !options.isRetryable(error)) {
        throw error;
      }

      const delayMs =
        options.getRetryDelayMs?.(error) ??
        fullJitterDelay(DEFAULT_BASE_DELAY_MS, attempt);
      if (
        options.deadline !== undefined &&
        Date.now() + delayMs >= options.deadline
      ) {
        throw createTimeoutError(options);
      }
      await sleep(delayMs, options.signal);
    }
  }
}

export function retryOperation<TResult>(
  operation: (signal?: AbortSignal) => Promise<TResult>,
  options: {
    signal?: AbortSignal;
    deadline?: number;
    timeoutError?: () => Error;
  } = {},
): Promise<TResult> {
  return retry(operation, {
    ...options,
    isRetryable: (error) =>
      error instanceof EdgeStoreNetworkError ||
      (error instanceof EdgeStoreApiError && isRetryableStatus(error.status)),
    getRetryDelayMs: (error) =>
      error instanceof EdgeStoreApiError &&
      error.retryAfterSeconds !== undefined
        ? error.retryAfterSeconds * 1000
        : undefined,
  });
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

export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function fullJitterDelay(baseDelayMs: number, attempt: number) {
  return Math.random() * baseDelayMs * 2 ** (attempt - 1);
}

function combineSignals(
  signal: AbortSignal | undefined,
  deadlineSignal: AbortSignal | undefined,
): AbortSignal | undefined {
  return signal && deadlineSignal
    ? AbortSignal.any([signal, deadlineSignal])
    : (signal ?? deadlineSignal);
}

function createTimeoutError(options: { timeoutError?: () => Error }): Error {
  return options.timeoutError?.() ?? new EdgeStoreNetworkError('Timed out.');
}
