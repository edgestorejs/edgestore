import {
  EdgeStoreUploadCleanupError,
  EdgeStoreUploadProcessingTimeoutError,
} from '../errors';
import type { MultipartUploadPlan } from '../multipartPlan';
import {
  DEFAULT_MULTIPART_CONCURRENCY,
  type UploadProgress,
} from '../uploadTypes';
import {
  uploadParts,
  uploadStreamParts,
  type CompletedUploadPart,
  type SignedUploadPart,
} from './multipartUpload';
import type { Transport } from './transport';
import { waitForUploadProcessing } from './uploadProcessing';
import {
  reportUploadProgress,
  type PreparedUploadSource,
} from './uploadSource';
import { putWithRetry } from './uploadTransfer';
import { getPositiveInteger } from './uploadValidation';

type RequestedUpload = {
  upload:
    | { id: string; kind: 'single'; signedUrl: string }
    | { id: string; kind: 'multipart'; parts: SignedUploadPart[] };
};

type UploadState = { upload: { status: string } };

type UploadLifecycleOperations<TResult extends UploadState> = {
  completeMultipart(input: {
    uploadId: string;
    parts: CompletedUploadPart[];
    signal?: AbortSignal;
  }): Promise<unknown>;
  get(input: {
    uploadId: string;
    signal?: AbortSignal;
  }): Promise<{ data: TResult; response: Response }>;
  cancel(input: { uploadId: string }): Promise<unknown>;
};

export async function executeUploadLifecycle<
  TResult extends UploadState,
>(options: {
  transport: Transport;
  requested: RequestedUpload;
  prepared: PreparedUploadSource;
  multipartPlan: MultipartUploadPlan | null;
  multipartConcurrency?: number;
  defaultMultipartConcurrency?: number;
  processingTimeoutMs: number;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  operations: UploadLifecycleOperations<TResult>;
  cleanupPolicy: 'preserve-original' | 'report-failure';
}): Promise<Extract<TResult, { upload: { status: 'completed' } }>> {
  const {
    transport,
    requested,
    prepared,
    multipartPlan,
    processingTimeoutMs,
    signal,
    onProgress,
    operations,
  } = options;
  const uploadId = requested.upload.id;
  const totalBytes = prepared.sizeBytes;

  try {
    reportUploadProgress(onProgress, {
      transferredBytes: 0,
      totalBytes,
      phase: 'uploading',
    });

    if (prepared.kind === 'body' && requested.upload.kind === 'single') {
      await putWithRetry(transport, {
        uploadId,
        url: requested.upload.signedUrl,
        body: prepared.body,
        signal,
      });
      reportUploadProgress(onProgress, {
        transferredBytes: totalBytes,
        totalBytes,
        phase: 'uploading',
      });
    } else {
      if (requested.upload.kind !== 'multipart' || !multipartPlan) {
        throw new TypeError(
          'The API returned an upload plan that does not match the request.',
        );
      }
      const transfer = {
        uploadId,
        parts: requested.upload.parts,
        partSizeBytes: multipartPlan.partSizeBytes,
        signal,
        onProgress,
      };
      const parts =
        prepared.kind === 'stream'
          ? await uploadStreamParts(transport, {
              ...transfer,
              stream: prepared.stream,
              totalBytes,
            })
          : await uploadParts(transport, {
              ...transfer,
              body: prepared.body,
              concurrency: getPositiveInteger(
                options.multipartConcurrency,
                options.defaultMultipartConcurrency ??
                  DEFAULT_MULTIPART_CONCURRENCY,
                'multipart.concurrency',
              ),
            });
      await operations.completeMultipart({ uploadId, parts, signal });
    }

    reportUploadProgress(onProgress, {
      transferredBytes: totalBytes,
      totalBytes,
      phase: 'processing',
    });
    return await waitForUploadProcessing<TResult>({
      uploadId,
      signal,
      timeoutMs: processingTimeoutMs,
      get: (requestSignal) =>
        operations.get({ uploadId, signal: requestSignal }),
    });
  } catch (error) {
    if (error instanceof EdgeStoreUploadProcessingTimeoutError) throw error;
    try {
      await operations.cancel({ uploadId });
    } catch (cleanupError) {
      if (options.cleanupPolicy === 'report-failure') {
        throw new EdgeStoreUploadCleanupError({
          message: `Automatic cancellation of upload ${uploadId} failed.`,
          uploadId,
          uploadCause: error,
          cleanupCause: cleanupError,
        });
      }
    }
    throw error;
  }
}
