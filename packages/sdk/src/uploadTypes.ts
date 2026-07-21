import type {
  RuntimeUploadGetResult,
  RuntimeUploadRequestInput,
  RuntimeUploadRequestResult,
} from './runtime';

export const DEFAULT_MULTIPART_THRESHOLD_BYTES = 100 * 1024 * 1024;
export const DEFAULT_MULTIPART_PART_SIZE_BYTES = 16 * 1024 * 1024;
export const DEFAULT_MULTIPART_CONCURRENCY = 4;
export const DEFAULT_UPLOAD_MAX_ATTEMPTS = 3;
export const DEFAULT_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;

export type UploadSource = Blob | ArrayBuffer | ArrayBufferView;
export type UploadMetadataValue = string | number | boolean | null | undefined;

export type UploadProgress = {
  transferredBytes: number;
  totalBytes: number;
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
        partSizeBytes?: number;
        concurrency?: number;
      };
  retry?: {
    maxAttempts?: number;
    baseDelayMs?: number;
  };
  processingTimeoutMs?: number;
};

export type CompletedUpload = Extract<
  RuntimeUploadGetResult,
  { upload: { status: 'completed' } }
>;

export type RuntimeUploadResult = CompletedUpload & {
  signedReadUrl?: RuntimeUploadRequestResult['signedReadUrl'];
};
