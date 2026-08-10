import { EdgeStoreAbortError, EdgeStoreNetworkError } from './errors';
import {
  createGetUploadRequest,
  type RuntimeOperations,
} from './internal/runtimeOperations';
import type { Transport } from './internal/transport';
import { executeUploadLifecycle } from './internal/uploadLifecycle';
import { isAbortError, throwIfAborted } from './internal/uploadRetry';
import {
  normalizeUploadMetadata,
  prepareUploadSource,
  reportUploadProgress,
} from './internal/uploadSource';
import { assertNonNegative } from './internal/uploadValidation';
import { planMultipartUpload } from './multipartPlan';
import {
  DEFAULT_PROCESSING_TIMEOUT_MS,
  type RuntimeUploadFromUrlInput,
  type RuntimeUploadInput,
  type RuntimeUploadResult,
  type UploadDefaults,
  type UploadSource,
} from './uploadTypes';

type ExplicitUploadInput = RuntimeUploadInput & { project: string };
type ExplicitUploadFromUrlInput = RuntimeUploadFromUrlInput & {
  project: string;
};

type UploadContext = {
  transport: Transport;
  operations: RuntimeOperations;
};

export async function uploadRuntimeFile(
  context: UploadContext,
  input: ExplicitUploadInput,
  defaults: UploadDefaults = {},
): Promise<RuntimeUploadResult> {
  const { transport, operations } = context;
  const {
    project,
    bucket,
    source,
    metadata,
    signal,
    onProgress,
    multipart,
    fileName,
    mimeType,
    temporary,
    path,
    extension,
    replaceTarget,
    signedReadUrl,
    processingTimeoutMs = defaults.processingTimeoutMs ??
      DEFAULT_PROCESSING_TIMEOUT_MS,
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

  const bucketResult = await operations.buckets.get({
    project,
    bucket,
    signal,
  });
  const partNumbers = multipartPlan?.partNumbers;

  const requested = await operations.uploads.request({
    project,
    bucket,
    bucketType: bucketResult.bucket.type,
    visibility: bucketResult.bucket.visibility,
    sizeBytes: totalBytes,
    fileName: fileName ?? prepared.fileName,
    mimeType: mimeType ?? prepared.mimeType,
    temporary,
    path,
    extension,
    metadata: normalizeUploadMetadata(metadata),
    replaceTarget,
    multipart: partNumbers ? { partNumbers } : undefined,
    signedReadUrl,
    signal,
  });
  const completed = await executeUploadLifecycle({
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
        operations.uploads.completeMultipart({
          project,
          uploadId,
          parts,
          signal: requestSignal,
        }),
      get: ({ uploadId, signal: requestSignal }) =>
        context.transport.executeWithResponse(
          createGetUploadRequest({
            project,
            uploadId,
            signal: requestSignal,
          }),
        ),
      cancel: ({ uploadId }) =>
        operations.uploads.cancel({ project, uploadId }),
    },
    cleanupPolicy: 'preserve-original',
  });

  return {
    ...completed,
    signedReadUrl: requested.signedReadUrl,
  };
}

export async function uploadRuntimeFileFromUrl(
  context: UploadContext,
  input: ExplicitUploadFromUrlInput,
  defaults: UploadDefaults = {},
): Promise<RuntimeUploadResult> {
  const { transport } = context;
  const { url, signal, fileName, mimeType, ...uploadInput } = input;
  let response: Response;

  try {
    response = await transport.fetch(url, {
      signal,
      headers: { 'accept-encoding': 'identity' },
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new EdgeStoreAbortError(undefined, { cause: error });
    }
    throw new EdgeStoreNetworkError(
      'The remote upload source could not be fetched.',
      {
        cause: error,
      },
    );
  }

  try {
    if (!response.ok) {
      throw new EdgeStoreNetworkError(
        `The remote upload source returned HTTP ${response.status}.`,
      );
    }

    const contentEncoding = response.headers.get('content-encoding');
    if (
      contentEncoding !== null &&
      contentEncoding.trim().toLowerCase() !== 'identity'
    ) {
      throw new TypeError(
        'Remote uploads require an identity Content-Encoding response.',
      );
    }

    const contentLength = response.headers.get('content-length');
    const sizeBytes =
      contentLength === null ? Number.NaN : Number(contentLength);
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
      throw new TypeError(
        'Remote uploads require a valid Content-Length response header.',
      );
    }
    if (!response.body && sizeBytes > 0) {
      throw new TypeError(
        'The remote upload source returned no response body.',
      );
    }

    const source: UploadSource = response.body
      ? { stream: response.body, sizeBytes }
      : new Blob([]);
    return await uploadRuntimeFile(
      context,
      {
        ...uploadInput,
        signal,
        source,
        fileName: fileName ?? getFileNameFromUrl(url),
        mimeType: mimeType ?? response.headers.get('content-type') ?? undefined,
      },
      defaults,
    );
  } finally {
    await cancelResponseBody(response.body);
  }
}

async function cancelResponseBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!body) return;
  await body.cancel().catch(() => undefined);
}

function getFileNameFromUrl(url: string): string | undefined {
  const name = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  return name ? decodeURIComponent(name) : undefined;
}
