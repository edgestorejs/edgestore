import {
  EdgeStoreAbortError,
  EdgeStoreNetworkError,
  EdgeStoreUploadCanceledError,
  EdgeStoreUploadProcessingTimeoutError,
} from './errors';
import type { Transport } from './internal/transport';
import {
  assertNonNegative,
  getPositiveInteger,
  getRetryAfterMs,
  putWithRetry,
  retryOperation,
  sleep,
  throwIfAborted,
  uploadParts,
  uploadStreamParts,
} from './internal/uploadTransfer';
import type { RuntimeUploadRequestInput } from './runtime';
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

type PreparedUploadSource = {
  sizeBytes: number;
  body?: Blob;
  stream?: ReadableStream<Uint8Array>;
  fileName?: string;
  mimeType?: string;
};

export async function uploadRuntimeFile(
  transport: Transport,
  input: ExplicitUploadInput,
  defaults: UploadDefaults = {},
): Promise<RuntimeUploadResult> {
  const {
    project,
    bucket,
    source,
    metadata,
    signal,
    onProgress,
    multipart,
    retry,
    fileName,
    mimeType,
    idempotencyKey,
    processingTimeoutMs = defaults.processingTimeoutMs ??
      DEFAULT_PROCESSING_TIMEOUT_MS,
    ...requestOptions
  } = input;
  const prepared = prepareSource(source);
  const totalBytes = prepared.sizeBytes;
  assertNonNegative(processingTimeoutMs, 'processingTimeoutMs');
  const multipartThresholdBytes =
    defaults.multipartThresholdBytes ?? DEFAULT_MULTIPART_THRESHOLD_BYTES;
  assertNonNegative(multipartThresholdBytes, 'upload.multipartThresholdBytes');
  const retryOptions = { ...defaults.retry, ...retry };
  const uploadIdempotencyKey = idempotencyKey ?? crypto.randomUUID();

  throwIfAborted(signal);
  reportProgress(onProgress, {
    transferredBytes: 0,
    totalBytes,
    phase: 'preparing',
  });

  const bucketResult = await getBucket(transport, {
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
    prepared.stream !== undefined ||
    multipart === true ||
    typeof multipart === 'object' ||
    totalBytes > multipartThresholdBytes;
  const partNumbers = useMultipart
    ? Array.from(
        { length: Math.max(1, Math.ceil(totalBytes / partSizeBytes)) },
        (_, index) => index + 1,
      )
    : undefined;

  const requested = await retryOperation(
    () =>
      requestUpload(transport, {
        project,
        bucket,
        bucketType: bucketResult.bucket.type,
        visibility: bucketResult.bucket.visibility,
        sizeBytes: totalBytes,
        fileName: fileName ?? prepared.fileName,
        mimeType: mimeType ?? prepared.mimeType,
        metadata: normalizeMetadata(metadata),
        multipart: partNumbers ? { partNumbers } : undefined,
        signal,
        ...requestOptions,
        idempotencyKey: uploadIdempotencyKey,
      }),
    retryOptions,
    signal,
  );
  const uploadId = requested.upload.id;

  try {
    reportProgress(onProgress, {
      transferredBytes: 0,
      totalBytes,
      phase: 'uploading',
    });

    if (requested.upload.kind === 'single') {
      if (!prepared.body) {
        throw new TypeError('Stream uploads require multipart upload URLs.');
      }
      await putWithRetry(transport, {
        uploadId,
        url: requested.upload.signedUrl,
        body: prepared.body,
        signal,
        retry: retryOptions,
      });
      reportProgress(onProgress, {
        transferredBytes: totalBytes,
        totalBytes,
        phase: 'uploading',
      });
    } else {
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
        retry: retryOptions,
        onProgress,
      };
      const completedParts = prepared.stream
        ? await uploadStreamParts(transport, {
            ...transferOptions,
            stream: prepared.stream,
            totalBytes,
          })
        : await uploadParts(transport, {
            ...transferOptions,
            body: prepared.body!,
            concurrency,
          });
      await completeMultipart(transport, {
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

    const completed = await waitForUpload(transport, {
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
      await cancelUpload(transport, project, uploadId);
    }
    throw error;
  }
}

export async function uploadRuntimeFileFromUrl(
  transport: Transport,
  input: ExplicitUploadFromUrlInput,
  defaults: UploadDefaults = {},
): Promise<RuntimeUploadResult> {
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

  if (!response.ok) {
    throw new EdgeStoreNetworkError(
      `The remote upload source returned HTTP ${response.status}.`,
    );
  }

  const sizeBytes = Number(response.headers.get('content-length'));
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
    throw new TypeError(
      'Remote uploads require a valid Content-Length response header.',
    );
  }

  const source: UploadSource = response.body
    ? { stream: response.body, sizeBytes }
    : new Blob([]);
  return uploadRuntimeFile(
    transport,
    {
      ...uploadInput,
      signal,
      source,
      fileName: fileName ?? getFileNameFromUrl(url),
      mimeType: mimeType ?? response.headers.get('content-type') ?? undefined,
    },
    defaults,
  );
}

async function getBucket(
  transport: Transport,
  options: { project: string; bucket: string; signal?: AbortSignal },
) {
  return transport.execute(() =>
    transport.client.GET(
      '/runtime/projects/{projectRef}/buckets/{bucketName}',
      {
        params: {
          path: {
            projectRef: options.project,
            bucketName: options.bucket,
          },
        },
        signal: options.signal,
      },
    ),
  );
}

async function requestUpload(
  transport: Transport,
  input: RuntimeUploadRequestInput & { project: string },
) {
  const { project, bucket, idempotencyKey, signal, ...body } = input;
  return transport.execute(() =>
    transport.client.POST(
      '/runtime/projects/{projectRef}/buckets/{bucketName}/uploads',
      {
        params: {
          path: { projectRef: project, bucketName: bucket },
          header: { 'idempotency-key': idempotencyKey },
        },
        body,
        signal,
      },
    ),
  );
}

async function completeMultipart(
  transport: Transport,
  options: {
    project: string;
    uploadId: string;
    parts: { partNumber: number; eTag: string }[];
    signal?: AbortSignal;
  },
) {
  await transport.execute(() =>
    transport.client.POST(
      '/runtime/projects/{projectRef}/uploads/{uploadId}/complete',
      {
        params: {
          path: {
            projectRef: options.project,
            uploadId: options.uploadId,
          },
        },
        body: { parts: options.parts },
        signal: options.signal,
      },
    ),
  );
}

async function waitForUpload(
  transport: Transport,
  options: {
    project: string;
    uploadId: string;
    signal?: AbortSignal;
    timeoutMs: number;
  },
): Promise<CompletedUpload> {
  const deadline = Date.now() + options.timeoutMs;

  while (true) {
    const { data, response } = await retryOperation(
      () =>
        transport.executeWithResponse(() =>
          transport.client.GET(
            '/runtime/projects/{projectRef}/uploads/{uploadId}',
            {
              params: {
                path: {
                  projectRef: options.project,
                  uploadId: options.uploadId,
                },
              },
              signal: options.signal,
            },
          ),
        ),
      undefined,
      options.signal,
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
      throw new EdgeStoreUploadProcessingTimeoutError(
        'Timed out while EdgeStore was processing the upload.',
        options.uploadId,
      );
    }
    await sleep(delayMs, options.signal);
  }
}

async function cancelUpload(
  transport: Transport,
  project: string,
  uploadId: string,
) {
  try {
    await transport.execute(() =>
      transport.client.DELETE(
        '/runtime/projects/{projectRef}/uploads/{uploadId}',
        { params: { path: { projectRef: project, uploadId } } },
      ),
    );
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
    return { body, sizeBytes: body.size, mimeType: body.type };
  }
  if (isStreamSource(source)) {
    if (!Number.isSafeInteger(source.sizeBytes) || source.sizeBytes < 0) {
      throw new RangeError('source.sizeBytes must be a non-negative integer.');
    }
    return { stream: source.stream, sizeBytes: source.sizeBytes };
  }
  if (source instanceof Blob) {
    return {
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
    return { body, sizeBytes: body.size };
  }
  const body = new Blob([
    Uint8Array.from(
      new Uint8Array(source.buffer, source.byteOffset, source.byteLength),
    ),
  ]);
  return { body, sizeBytes: body.size };
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
