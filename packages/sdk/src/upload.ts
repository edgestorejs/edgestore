import {
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
} from './internal/uploadTransfer';
import type { RuntimeUploadRequestInput } from './runtime';
import {
  DEFAULT_MULTIPART_CONCURRENCY,
  DEFAULT_MULTIPART_PART_SIZE_BYTES,
  DEFAULT_MULTIPART_THRESHOLD_BYTES,
  DEFAULT_PROCESSING_TIMEOUT_MS,
  type CompletedUpload,
  type RuntimeUploadInput,
  type RuntimeUploadResult,
  type UploadMetadataValue,
  type UploadSource,
} from './uploadTypes';

type ExplicitUploadInput = RuntimeUploadInput & { project: string };

export async function uploadRuntimeFile(
  transport: Transport,
  input: ExplicitUploadInput,
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
    processingTimeoutMs = DEFAULT_PROCESSING_TIMEOUT_MS,
    ...requestOptions
  } = input;
  const body = toBlob(source);
  assertNonNegative(processingTimeoutMs, 'processingTimeoutMs');
  const uploadIdempotencyKey = idempotencyKey ?? crypto.randomUUID();
  const bucketResult = await getBucket(transport, {
    project,
    bucket,
    signal,
  });
  const partSizeBytes = getPositiveInteger(
    typeof multipart === 'object' ? multipart.partSizeBytes : undefined,
    DEFAULT_MULTIPART_PART_SIZE_BYTES,
    'multipart.partSizeBytes',
  );
  const useMultipart =
    multipart === true ||
    typeof multipart === 'object' ||
    body.size > DEFAULT_MULTIPART_THRESHOLD_BYTES;
  const partNumbers = useMultipart
    ? Array.from(
        { length: Math.max(1, Math.ceil(body.size / partSizeBytes)) },
        (_, index) => index + 1,
      )
    : undefined;

  if (partNumbers && partNumbers.length > 10_000) {
    throw new RangeError(
      'Multipart uploads cannot contain more than 10,000 parts.',
    );
  }

  throwIfAborted(signal);
  onProgress?.({
    transferredBytes: 0,
    totalBytes: body.size,
    percentage: 0,
    phase: 'transfer',
  });

  const requested = await retryOperation(
    () =>
      requestUpload(transport, {
        project,
        bucket,
        bucketType: bucketResult.bucket.type,
        visibility: bucketResult.bucket.visibility,
        sizeBytes: body.size,
        fileName: fileName ?? getSourceName(source),
        mimeType: mimeType ?? getSourceMimeType(source),
        metadata: normalizeMetadata(metadata),
        multipart: partNumbers ? { partNumbers } : undefined,
        signal,
        ...requestOptions,
        idempotencyKey: uploadIdempotencyKey,
      }),
    retry,
    signal,
  );
  const uploadId = requested.upload.id;

  try {
    if (requested.upload.kind === 'single') {
      await putWithRetry(transport, {
        uploadId,
        url: requested.upload.signedUrl,
        body,
        signal,
        retry,
      });
    } else {
      const completedParts = await uploadParts(transport, {
        body,
        uploadId,
        parts: requested.upload.parts,
        partSizeBytes,
        concurrency: getPositiveInteger(
          typeof multipart === 'object' ? multipart.concurrency : undefined,
          DEFAULT_MULTIPART_CONCURRENCY,
          'multipart.concurrency',
        ),
        signal,
        retry,
        onProgress,
      });
      await completeMultipart(transport, {
        project,
        uploadId,
        parts: completedParts,
        signal,
      });
    }

    onProgress?.({
      transferredBytes: body.size,
      totalBytes: body.size,
      percentage: 100,
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

function toBlob(source: UploadSource): Blob {
  if (source instanceof Blob) return source;
  if (source instanceof ArrayBuffer) return new Blob([source]);
  return new Blob([
    Uint8Array.from(
      new Uint8Array(source.buffer, source.byteOffset, source.byteLength),
    ),
  ]);
}

function getSourceName(source: UploadSource): string | undefined {
  return 'name' in source && typeof source.name === 'string'
    ? source.name
    : undefined;
}

function getSourceMimeType(source: UploadSource): string | undefined {
  return source instanceof Blob && source.type ? source.type : undefined;
}
