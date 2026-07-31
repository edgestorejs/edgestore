import type {
  RuntimeUploadGetResult,
  RuntimeUploadRequestInput,
  RuntimeUploadRequestResult,
} from './runtime';

export const DEFAULT_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024;
export const MIN_MULTIPART_PART_SIZE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MULTIPART_CONCURRENCY = 4;
export const DEFAULT_PROCESSING_TIMEOUT_MS = 60 * 1000;
export const MAX_MULTIPART_PARTS = 10_000;

export type UploadStreamSource = {
  stream: ReadableStream<Uint8Array>;
  sizeBytes: number;
};
export type UploadSource =
  Blob | ArrayBuffer | ArrayBufferView | string | UploadStreamSource;
export type UploadMetadataValue = string | number | boolean | null | undefined;

export type UploadProgress = {
  transferredBytes: number;
  totalBytes: number;
  percentage: number;
  phase: 'preparing' | 'uploading' | 'processing';
};

export type UploadDefaults = {
  multipartThresholdBytes?: number;
  /** Multipart part size in bytes. Must be at least 5 MiB. */
  multipartPartSizeBytes?: number;
  multipartConcurrency?: number;
  processingTimeoutMs?: number;
};

export type RuntimeUploadInput = Omit<
  RuntimeUploadRequestInput,
  | 'bucketType'
  | 'visibility'
  | 'sizeBytes'
  | 'metadata'
  | 'multipart'
  | 'signal'
> & {
  source: UploadSource;
  metadata?: Record<string, UploadMetadataValue>;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
  multipart?:
    | boolean
    | {
        /** Multipart part size in bytes. Must be at least 5 MiB. */
        partSizeBytes?: number;
        concurrency?: number;
      };
  processingTimeoutMs?: number;
};

export type RuntimeUploadFromUrlInput = Omit<RuntimeUploadInput, 'source'> & {
  url: string;
};

export type CompletedUpload = Extract<
  RuntimeUploadGetResult,
  { upload: { status: 'completed' } }
>;

export type RuntimeUploadResult = CompletedUpload & {
  signedReadUrl?: RuntimeUploadRequestResult['signedReadUrl'];
};
