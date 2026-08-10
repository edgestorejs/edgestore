/** Base class for errors raised by the EdgeStore SDK. */
export class EdgeStoreError extends Error {
  override readonly name: string = 'EdgeStoreError';
}

/** A non-success response returned by the EdgeStore API. */
export class EdgeStoreApiError extends EdgeStoreError {
  override readonly name = 'EdgeStoreApiError';
  /** HTTP response status. */
  readonly status: number;
  /** Stable machine-readable API error code. */
  readonly code: string;
  /** Structured error details, when provided by the API. */
  readonly details: unknown;
  /** EdgeStore request identifier for tracing and support. */
  readonly requestId: string | undefined;
  /** Server-requested retry delay parsed from `Retry-After`. */
  readonly retryAfterSeconds: number | undefined;

  constructor(options: {
    message: string;
    status: number;
    code: string;
    details?: unknown;
    requestId?: string;
    retryAfterSeconds?: number;
  }) {
    super(options.message);
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.requestId = options.requestId;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

/** A request that could not reach the API or upload destination. */
export class EdgeStoreNetworkError extends EdgeStoreError {
  override readonly name = 'EdgeStoreNetworkError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** A control-plane request that exceeded the configured deadline. */
export class EdgeStoreTimeoutError extends EdgeStoreError {
  override readonly name = 'EdgeStoreTimeoutError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** A request or upload canceled through an `AbortSignal`. */
export class EdgeStoreAbortError extends EdgeStoreError {
  override readonly name = 'EdgeStoreAbortError';

  constructor(
    message = 'The EdgeStore request was aborted.',
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** Base class for failures tied to an upload created by the SDK. */
export class EdgeStoreUploadError extends EdgeStoreError {
  override readonly name: string = 'EdgeStoreUploadError';
  /** Upload identifier that can be used for diagnostics. */
  readonly uploadId: string;

  constructor(message: string, uploadId: string, options?: ErrorOptions) {
    super(message, options);
    this.uploadId = uploadId;
  }
}

/** An upload canceled before it reached a completed state. */
export class EdgeStoreUploadCanceledError extends EdgeStoreUploadError {
  override readonly name = 'EdgeStoreUploadCanceledError';
}

/** An upload that did not finish server-side processing before its deadline. */
export class EdgeStoreUploadProcessingTimeoutError extends EdgeStoreUploadError {
  override readonly name = 'EdgeStoreUploadProcessingTimeoutError';
}

/** An upload failure whose automatic cancellation also failed. */
export class EdgeStoreUploadCleanupError extends EdgeStoreUploadError {
  override readonly name = 'EdgeStoreUploadCleanupError';

  readonly uploadCause: unknown;
  readonly cleanupCause: unknown;

  constructor(options: {
    message: string;
    uploadId: string;
    uploadCause: unknown;
    cleanupCause: unknown;
  }) {
    super(options.message, options.uploadId, { cause: options.uploadCause });
    this.uploadCause = options.uploadCause;
    this.cleanupCause = options.cleanupCause;
  }
}

/** Failure returned for a singular file mutation. */
export class EdgeStoreFileMutationError<
  TFileReference = { id: string } | { key: string } | { url: string },
  TCode extends string =
    | 'FILE_NOT_CONFIRMABLE'
    | 'FILE_NOT_DELETABLE'
    | 'FILE_NOT_RESTORABLE'
    | 'INVALID_FILE_REF',
> extends EdgeStoreError {
  override readonly name = 'EdgeStoreFileMutationError';

  constructor(
    readonly code: TCode,
    message: string,
    readonly fileRef: TFileReference,
  ) {
    super(message);
  }
}
