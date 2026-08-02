import {
  EdgeStoreUploadCanceledError,
  EdgeStoreUploadProcessingTimeoutError,
} from '../errors';
import { getRetryAfterMs, retryOperation, sleep } from './uploadRetry';

type UploadState = { upload: { status: string } };

export async function waitForUploadProcessing<
  TResult extends UploadState,
>(options: {
  uploadId: string;
  signal?: AbortSignal;
  timeoutMs: number;
  get(signal?: AbortSignal): Promise<{ data: TResult; response: Response }>;
}): Promise<Extract<TResult, { upload: { status: 'completed' } }>> {
  const deadline = Date.now() + options.timeoutMs;
  const timeoutError = () =>
    new EdgeStoreUploadProcessingTimeoutError(
      'Timed out while EdgeStore was processing the upload.',
      options.uploadId,
    );

  while (true) {
    const { data, response } = await retryOperation(
      (signal) => options.get(signal),
      {
        signal: options.signal,
        deadline,
        timeoutError,
      },
    );

    if (data.upload.status === 'completed') {
      return data as Extract<TResult, { upload: { status: 'completed' } }>;
    }
    if (data.upload.status === 'canceled') {
      throw new EdgeStoreUploadCanceledError(
        'The EdgeStore upload was canceled.',
        options.uploadId,
      );
    }

    const delayMs = getRetryAfterMs(response) ?? 1000;
    if (Date.now() + delayMs > deadline) throw timeoutError();
    await sleep(delayMs, options.signal);
  }
}
