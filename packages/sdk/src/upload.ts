import {
  EdgeStoreAbortError,
  EdgeStoreNetworkError,
  EdgeStoreUploadCanceledError,
  EdgeStoreUploadProcessingTimeoutError,
} from './errors';
import { uploadParts, uploadStreamParts } from './internal/multipartUpload';
import {
  createGetUploadRequest,
  type RuntimeOperations,
} from './internal/runtimeOperations';
import type { Transport } from './internal/transport';
import {
  getRetryAfterMs,
  isAbortError,
  retryOperation,
  sleep,
  throwIfAborted,
} from './internal/uploadRetry';
import { putWithRetry } from './internal/uploadTransfer';
import {
  assertNonNegative,
  getPositiveInteger,
} from './internal/uploadValidation';
import {
  DEFAULT_MULTIPART_CONCURRENCY,
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
  DEFAULT_PROCESSING_TIMEOUT_MS,
  MAX_MULTIPART_PARTS,
  type CompletedUpload,
  type RuntimeUploadFromUrlInput,
  type RuntimeUploadInput,
  type RuntimeUploadResult,
  type UploadDefaults,
  type UploadMetadataValue,
  type UploadSource,
  type UploadStreamSource,
} from './uploadTypes';

type ExplicitUploadInput = RuntimeUploadInput & { project: string };
type ExplicitUploadFromUrlInput = RuntimeUploadFromUrlInput & {
  project: string;
};

type PreparedUploadDetails = {
  sizeBytes: number;
  fileName?: string;
  mimeType?: string;
};
type PreparedUploadSource =
  | (PreparedUploadDetails & { kind: 'body'; body: Blob })
  | (PreparedUploadDetails & {
      kind: 'stream';
      stream: ReadableStream<Uint8Array>;
    });
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
  const prepared = prepareSource(source);
  const totalBytes = prepared.sizeBytes;
  assertNonNegative(processingTimeoutMs, 'processingTimeoutMs');
  const multipartThresholdBytes =
    defaults.multipartThresholdBytes ?? DEFAULT_MULTIPART_THRESHOLD_BYTES;
  assertNonNegative(multipartThresholdBytes, 'upload.multipartThresholdBytes');

  throwIfAborted(signal);
  reportProgress(onProgress, {
    transferredBytes: 0,
    totalBytes,
    phase: 'preparing',
  });

  const bucketResult = await operations.buckets.get({
    project,
    bucket,
    signal,
  });
  const requestedPartSizeBytes = getPositiveInteger(
    typeof multipart === 'object'
      ? multipart.partSizeBytes
      : defaults.multipartPartSizeBytes,
    defaults.multipartPartSizeBytes ?? DEFAULT_MULTIPART_PART_SIZE_BYTES,
    'multipart.partSizeBytes',
  );
  const partSizeBytes = Math.max(
    requestedPartSizeBytes,
    Math.ceil(totalBytes / MAX_MULTIPART_PARTS),
  );
  const useMultipart =
    prepared.kind === 'stream' ||
    multipart === true ||
    typeof multipart === 'object' ||
    totalBytes > multipartThresholdBytes;
  const partNumbers = useMultipart
    ? Array.from(
        { length: Math.max(1, Math.ceil(totalBytes / partSizeBytes)) },
        (_, index) => index + 1,
      )
    : undefined;

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
    metadata: normalizeMetadata(metadata),
    replaceTarget,
    multipart: partNumbers ? { partNumbers } : undefined,
    signedReadUrl,
    signal,
  });
  const uploadId = requested.upload.id;

  try {
    reportProgress(onProgress, {
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
      reportProgress(onProgress, {
        transferredBytes: totalBytes,
        totalBytes,
        phase: 'uploading',
      });
    } else {
      if (requested.upload.kind !== 'multipart') {
        throw new TypeError(
          'The API returned a single upload URL for a stream source.',
        );
      }
      const concurrency = getPositiveInteger(
        typeof multipart === 'object'
          ? multipart.concurrency
          : defaults.multipartConcurrency,
        defaults.multipartConcurrency ?? DEFAULT_MULTIPART_CONCURRENCY,
        'multipart.concurrency',
      );
      const transferOptions = {
        uploadId,
        parts: requested.upload.parts,
        partSizeBytes,
        signal,
        onProgress,
      };
      const completedParts =
        prepared.kind === 'stream'
          ? await uploadStreamParts(transport, {
              ...transferOptions,
              stream: prepared.stream,
              totalBytes,
            })
          : await uploadParts(transport, {
              ...transferOptions,
              body: prepared.body,
              concurrency,
            });
      await operations.uploads.completeMultipart({
        project,
        uploadId,
        parts: completedParts,
        signal,
      });
    }

    reportProgress(onProgress, {
      transferredBytes: totalBytes,
      totalBytes,
      phase: 'processing',
    });

    const completed = await waitForUpload(context, {
      project,
      uploadId,
      signal,
      timeoutMs: processingTimeoutMs,
    });

    return {
      ...completed,
      signedReadUrl: requested.signedReadUrl,
    };
  } catch (error) {
    if (!(error instanceof EdgeStoreUploadProcessingTimeoutError)) {
      await cancelUpload(operations, project, uploadId);
    }
    throw error;
  }
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
    response = await transport.fetch(url, { signal });
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

async function waitForUpload(
  context: UploadContext,
  options: {
    project: string;
    uploadId: string;
    signal?: AbortSignal;
    timeoutMs: number;
  },
): Promise<CompletedUpload> {
  const deadline = Date.now() + options.timeoutMs;
  const timeoutError = () =>
    new EdgeStoreUploadProcessingTimeoutError(
      'Timed out while EdgeStore was processing the upload.',
      options.uploadId,
    );

  while (true) {
    const { data, response } = await retryOperation(
      (signal) =>
        context.transport.executeWithResponse(
          createGetUploadRequest({
            project: options.project,
            uploadId: options.uploadId,
            signal,
          }),
        ),
      {
        signal: options.signal,
        deadline,
        timeoutError,
      },
    );

    if (data.upload.status === 'completed' && 'file' in data) return data;
    if (data.upload.status === 'canceled') {
      throw new EdgeStoreUploadCanceledError(
        'The EdgeStore upload was canceled.',
        options.uploadId,
      );
    }

    const delayMs = getRetryAfterMs(response) ?? 1000;
    if (Date.now() + delayMs > deadline) {
      throw timeoutError();
    }
    await sleep(delayMs, options.signal);
  }
}

async function cancelUpload(
  operations: RuntimeOperations,
  project: string,
  uploadId: string,
) {
  try {
    await operations.uploads.cancel({ project, uploadId });
  } catch {
    // Preserve the original upload failure.
  }
}

function normalizeMetadata(
  metadata?: Record<string, UploadMetadataValue>,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata).flatMap(([key, value]) =>
    value === null || value === undefined ? [] : [[key, String(value)]],
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function prepareSource(source: UploadSource): PreparedUploadSource {
  if (typeof source === 'string') {
    const body = new Blob([source], { type: 'text/plain' });
    return {
      kind: 'body',
      body,
      sizeBytes: body.size,
      mimeType: body.type,
    };
  }
  if (isStreamSource(source)) {
    if (!Number.isSafeInteger(source.sizeBytes) || source.sizeBytes < 0) {
      throw new RangeError('source.sizeBytes must be a non-negative integer.');
    }
    return {
      kind: 'stream',
      stream: source.stream,
      sizeBytes: source.sizeBytes,
    };
  }
  if (source instanceof Blob) {
    return {
      kind: 'body',
      body: source,
      sizeBytes: source.size,
      fileName:
        'name' in source && typeof source.name === 'string'
          ? source.name
          : undefined,
      mimeType: source.type || undefined,
    };
  }
  if (source instanceof ArrayBuffer) {
    const body = new Blob([source]);
    return { kind: 'body', body, sizeBytes: body.size };
  }
  const body = new Blob([
    Uint8Array.from(
      new Uint8Array(source.buffer, source.byteOffset, source.byteLength),
    ),
  ]);
  return { kind: 'body', body, sizeBytes: body.size };
}

function isStreamSource(source: UploadSource): source is UploadStreamSource {
  const stream =
    typeof source === 'object' && source !== null && 'stream' in source
      ? source.stream
      : undefined;
  return (
    typeof stream === 'object' &&
    stream !== null &&
    'getReader' in stream &&
    typeof stream.getReader === 'function'
  );
}

function reportProgress(
  onProgress: RuntimeUploadInput['onProgress'],
  progress: {
    transferredBytes: number;
    totalBytes: number;
    phase: 'preparing' | 'uploading' | 'processing';
  },
) {
  const { transferredBytes, totalBytes, phase } = progress;
  onProgress?.({
    transferredBytes,
    totalBytes,
    percentage:
      totalBytes === 0
        ? phase === 'preparing'
          ? 0
          : 100
        : Math.round((transferredBytes / totalBytes) * 10_000) / 100,
    phase,
  });
}

function getFileNameFromUrl(url: string): string | undefined {
  const name = new URL(url).pathname.split('/').filter(Boolean).at(-1);
  return name ? decodeURIComponent(name) : undefined;
}
