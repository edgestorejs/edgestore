import type {
  UploadMetadataValue,
  UploadProgress,
  UploadSource,
  UploadStreamSource,
} from '../uploadTypes';

type PreparedUploadDetails = {
  sizeBytes: number;
  fileName?: string;
  mimeType?: string;
};

export type PreparedUploadSource =
  | (PreparedUploadDetails & { kind: 'body'; body: Blob })
  | (PreparedUploadDetails & {
      kind: 'stream';
      stream: ReadableStream<Uint8Array>;
    });

export function prepareUploadSource(
  source: UploadSource,
): PreparedUploadSource {
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

export function normalizeUploadMetadata(
  metadata?: Record<string, UploadMetadataValue>,
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const entries = Object.entries(metadata).flatMap(([key, value]) =>
    value === null || value === undefined ? [] : [[key, String(value)]],
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export function reportUploadProgress(
  onProgress: ((progress: UploadProgress) => void) | undefined,
  progress: Omit<UploadProgress, 'percentage'>,
): void {
  const { transferredBytes, totalBytes, phase } = progress;
  onProgress?.({
    ...progress,
    percentage:
      totalBytes === 0
        ? phase === 'preparing'
          ? 0
          : 100
        : Math.round((transferredBytes / totalBytes) * 10_000) / 100,
  });
}

function isStreamSource(source: UploadSource): source is UploadStreamSource {
  const stream =
    typeof source === 'object' && source !== null && 'stream' in source
      ? Reflect.get(source, 'stream')
      : undefined;
  return (
    typeof stream === 'object' &&
    stream !== null &&
    'getReader' in stream &&
    typeof Reflect.get(stream, 'getReader') === 'function'
  );
}
