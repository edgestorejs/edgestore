import type {
  RuntimeUploadGetResult,
  RuntimeUploadRequestInput,
  RuntimeUploadRequestResult,
} from './runtime';

/** Default size above which uploads use multipart transfer: 100 MiB. */
export const DEFAULT_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;
/** Default multipart part size: 16 MiB. */
export const DEFAULT_MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024;
/** Minimum supported multipart part size: 5 MiB. */
export const MIN_MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024;
/** Default number of parallel multipart transfers for in-memory sources. */
export const DEFAULT_MULTIPART_CONCURRENCY = 4;
/** Default deadline for server-side upload processing: 60 seconds. */
export const DEFAULT_PROCESSING_TIMEOUT_MS = 60 * 1000;
/** Maximum number of parts supported by one multipart upload. */
export const MAX_MULTIPART_PARTS = 10_000;

/** Stream upload input with the exact number of bytes the stream will emit. */
export type UploadStreamSource = {
  /** Byte stream. Stream sources are uploaded sequentially as multipart data. */
  stream: ReadableStream<Uint8Array>;
  /** Exact stream length used to allocate multipart upload URLs. */
  sizeBytes: number;
};

/** Data accepted by the high-level upload helper. Strings are UTF-8 encoded. */
export type UploadSource =
  Blob | ArrayBuffer | ArrayBufferView | string | UploadStreamSource;
/** Metadata value accepted by EdgeStore. `undefined` fields are omitted. */
export type UploadMetadataValue = string | number | boolean | null | undefined;

/** Progress emitted while the SDK prepares, transfers, and processes a file. */
export type UploadProgress = {
  /** Bytes transferred to storage. */
  transferredBytes: number;
  /** Total source size in bytes. */
  totalBytes: number;
  /** Transfer percentage from `0` to `100`. */
  percentage: number;
  /** Current high-level upload phase. */
  phase: 'preparing' | 'uploading' | 'processing';
};

/** Defaults applied to every high-level upload created by an SDK instance. */
export type UploadDefaults = {
  /** Size above which multipart upload is automatic. @defaultValue 104857600 */
  multipartThresholdBytes?: number;
  /** Preferred multipart part size. Must be at least 5 MiB. @defaultValue 16777216 */
  multipartPartSizeBytes?: number;
  /** Parallel transfers for in-memory sources. @defaultValue 4 */
  multipartConcurrency?: number;
  /** Server-side processing deadline in milliseconds. @defaultValue 60000 */
  processingTimeoutMs?: number;
};

/** Input for a complete upload managed by the SDK. */
export type RuntimeUploadInput = Omit<
  RuntimeUploadRequestInput,
  | 'bucketType'
  | 'visibility'
  | 'sizeBytes'
  | 'metadata'
  | 'multipart'
  | 'signal'
> & {
  /** File data to upload. */
  source: UploadSource;
  /** Custom metadata stored with the file. */
  metadata?: Record<string, UploadMetadataValue>;
  /** Cancels setup, transfer, and processing polling. */
  signal?: AbortSignal;
  /** Receives upload progress and phase transitions. */
  onProgress?: (progress: UploadProgress) => void;
  /** Force multipart mode or override its part size and concurrency. */
  multipart?:
    | boolean
    | {
        /** Multipart part size in bytes. Must be at least 5 MiB. */
        partSizeBytes?: number;
        concurrency?: number;
      };
  /** Per-upload server-side processing deadline in milliseconds. */
  processingTimeoutMs?: number;
};

/** Input for uploading a remote URL through the high-level helper. */
export type RuntimeUploadFromUrlInput = Omit<RuntimeUploadInput, 'source'> & {
  /** Public URL fetched by this SDK process before upload. */
  url: string;
};

export type CompletedUpload = Extract<
  RuntimeUploadGetResult,
  { upload: { status: 'completed' } }
>;

/** Completed file and upload records returned by a high-level upload. */
export type RuntimeUploadResult = CompletedUpload & {
  /** Signed read URL returned during upload setup, when applicable. */
  signedReadUrl?: RuntimeUploadRequestResult['signedReadUrl'];
};
