import type { ManagementUploadOperations } from './internal/managementUploadOperations';
import type { OperationBody, OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';
import { executeUploadLifecycle } from './internal/uploadLifecycle';
import { throwIfAborted } from './internal/uploadRetry';
import {
  normalizeUploadMetadata,
  prepareUploadSource,
  reportUploadProgress,
} from './internal/uploadSource';
import { assertNonNegative } from './internal/uploadValidation';
import { planMultipartUpload } from './multipartPlan';
import type {
  UploadDefaults,
  UploadMetadataValue,
  UploadProgress,
  UploadSource,
} from './uploadTypes';
import { DEFAULT_PROCESSING_TIMEOUT_MS } from './uploadTypes';

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
  context: {
    transport: Transport;
    operations: ManagementUploadOperations;
  },
  input: ManagementUploadInput,
  defaults: UploadDefaults = {},
): Promise<ManagementUploadResult> {
  const { transport, operations } = context;
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
  const requested = await operations.request({
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
  const completed = await executeUploadLifecycle<GetResult>({
    transport,
    requested,
    prepared,
    multipartPlan,
    multipartConcurrency:
      typeof multipart === 'object'
        ? multipart.concurrency
        : defaults.multipartConcurrency,
    defaultMultipartConcurrency: defaults.multipartConcurrency,
    processingTimeoutMs,
    signal,
    onProgress,
    operations: {
      completeMultipart: ({ uploadId, parts, signal: requestSignal }) =>
        operations.completeMultipart({
          project,
          uploadId,
          parts,
          signal: requestSignal,
        }),
      get: ({ uploadId, signal: requestSignal }) =>
        operations.getWithResponse({
          project,
          uploadId,
          signal: requestSignal,
        }),
      cancel: ({ uploadId }) => operations.cancel({ project, uploadId }),
    },
    cleanupPolicy: 'report-failure',
  });
  return { ...completed, signedReadUrl: requested.signedReadUrl };
}
