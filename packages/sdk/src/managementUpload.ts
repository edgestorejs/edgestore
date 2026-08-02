import {
  EdgeStoreUploadCleanupError,
  EdgeStoreUploadProcessingTimeoutError,
} from './errors';
import { uploadParts, uploadStreamParts } from './internal/multipartUpload';
import type { OperationBody, OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';
import { waitForUploadProcessing } from './internal/uploadProcessing';
import { throwIfAborted } from './internal/uploadRetry';
import {
  normalizeUploadMetadata,
  prepareUploadSource,
  reportUploadProgress,
} from './internal/uploadSource';
import { putWithRetry } from './internal/uploadTransfer';
import {
  assertNonNegative,
  getPositiveInteger,
} from './internal/uploadValidation';
import { planMultipartUpload } from './multipartPlan';
import type {
  UploadDefaults,
  UploadMetadataValue,
  UploadProgress,
  UploadSource,
} from './uploadTypes';
import {
  DEFAULT_MULTIPART_CONCURRENCY,
  DEFAULT_PROCESSING_TIMEOUT_MS,
} from './uploadTypes';

type RequestBody = OperationBody<'v2.management.uploads.request'>;
type RequestResult = OperationResult<'v2.management.uploads.request'>;
type GetResult = OperationResult<'v2.management.uploads.get'>;
type CompletedUpload = Extract<GetResult, { upload: { status: 'completed' } }>;

/** Input for a complete administrative upload managed by the SDK. */
export type ManagementUploadInput = Omit<
  RequestBody,
  'sizeBytes' | 'metadata' | 'multipart'
> & {
  project: string;
  bucket: string;
  source: UploadSource;
  metadata?: Record<string, UploadMetadataValue>;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  multipart?:
    | boolean
    | {
        partSizeBytes?: number;
        concurrency?: number;
      };
  processingTimeoutMs?: number;
};

/** Completed administrative file upload. */
export type ManagementUploadResult = CompletedUpload & {
  signedReadUrl?: RequestResult['signedReadUrl'];
};

export async function uploadManagementFile(
  transport: Transport,
  input: ManagementUploadInput,
  defaults: UploadDefaults = {},
): Promise<ManagementUploadResult> {
  const {
    project,
    bucket,
    source,
    metadata,
    signal,
    onProgress,
    multipart,
    processingTimeoutMs = defaults.processingTimeoutMs ??
      DEFAULT_PROCESSING_TIMEOUT_MS,
    ...requestInput
  } = input;
  const prepared = prepareUploadSource(source);
  const totalBytes = prepared.sizeBytes;
  assertNonNegative(processingTimeoutMs, 'processingTimeoutMs');
  throwIfAborted(signal);
  reportUploadProgress(onProgress, {
    transferredBytes: 0,
    totalBytes,
    phase: 'preparing',
  });

  const multipartPlan = planMultipartUpload({
    sizeBytes: totalBytes,
    thresholdBytes: defaults.multipartThresholdBytes,
    preferredPartSizeBytes:
      typeof multipart === 'object'
        ? (multipart.partSizeBytes ?? defaults.multipartPartSizeBytes)
        : defaults.multipartPartSizeBytes,
    forceMultipart:
      prepared.kind === 'stream' ||
      multipart === true ||
      typeof multipart === 'object',
  });
  const requested = await requestUpload(transport, {
    project,
    bucket,
    signal,
    ...requestInput,
    fileName: requestInput.fileName ?? prepared.fileName,
    mimeType: requestInput.mimeType ?? prepared.mimeType,
    sizeBytes: totalBytes,
    metadata: normalizeUploadMetadata(metadata),
    multipart: multipartPlan
      ? { partNumbers: multipartPlan.partNumbers }
      : undefined,
  });
  const uploadId = requested.upload.id;

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
                typeof multipart === 'object'
                  ? multipart.concurrency
                  : defaults.multipartConcurrency,
                defaults.multipartConcurrency ?? DEFAULT_MULTIPART_CONCURRENCY,
                'multipart.concurrency',
              ),
            });
      await completeMultipart(transport, {
        project,
        uploadId,
        parts,
        signal,
      });
    }

    reportUploadProgress(onProgress, {
      transferredBytes: totalBytes,
      totalBytes,
      phase: 'processing',
    });
    const completed = await waitForUploadProcessing<GetResult>({
      uploadId,
      signal,
      timeoutMs: processingTimeoutMs,
      get: (requestSignal) =>
        getUpload(transport, { project, uploadId, signal: requestSignal }),
    });
    return { ...completed, signedReadUrl: requested.signedReadUrl };
  } catch (error) {
    if (!(error instanceof EdgeStoreUploadProcessingTimeoutError)) {
      try {
        await cancelUpload(transport, project, uploadId);
      } catch (cleanupError) {
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

function requestUpload(
  transport: Transport,
  input: RequestBody & {
    project: string;
    bucket: string;
    signal?: AbortSignal;
  },
): Promise<RequestResult> {
  const { project, bucket, signal, ...body } = input;
  return transport.execute((client) =>
    client.POST(
      '/management/projects/{projectRef}/buckets/{bucketName}/uploads',
      {
        params: { path: { projectRef: project, bucketName: bucket } },
        body,
        signal,
      },
    ),
  );
}

function completeMultipart(
  transport: Transport,
  input: OperationBody<'v2.management.uploads.multipart.complete'> & {
    project: string;
    uploadId: string;
    signal?: AbortSignal;
  },
) {
  const { project, uploadId, signal, ...body } = input;
  return transport.execute((client) =>
    client.POST(
      '/management/projects/{projectRef}/uploads/{uploadId}/complete',
      {
        params: { path: { projectRef: project, uploadId } },
        body,
        signal,
      },
    ),
  );
}

function getUpload(
  transport: Transport,
  input: { project: string; uploadId: string; signal?: AbortSignal },
) {
  return transport.executeWithResponse((client) =>
    client.GET('/management/projects/{projectRef}/uploads/{uploadId}', {
      params: {
        path: { projectRef: input.project, uploadId: input.uploadId },
      },
      signal: input.signal,
    }),
  );
}

function cancelUpload(transport: Transport, project: string, uploadId: string) {
  return transport.execute((client) =>
    client.DELETE('/management/projects/{projectRef}/uploads/{uploadId}', {
      params: { path: { projectRef: project, uploadId } },
    }),
  );
}
