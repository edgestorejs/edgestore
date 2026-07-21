export class EdgeStoreError extends Error {
  override readonly name: string = 'EdgeStoreError';
}

export class EdgeStoreApiError extends EdgeStoreError {
  override readonly name = 'EdgeStoreApiError';
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | undefined;
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

export class EdgeStoreNetworkError extends EdgeStoreError {
  override readonly name = 'EdgeStoreNetworkError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class EdgeStoreAbortError extends EdgeStoreError {
  override readonly name = 'EdgeStoreAbortError';

  constructor(
    message = 'The EdgeStore request was aborted.',
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export class EdgeStoreUploadError extends EdgeStoreError {
  override readonly name: string = 'EdgeStoreUploadError';
  readonly uploadId: string;

  constructor(message: string, uploadId: string, options?: ErrorOptions) {
    super(message, options);
    this.uploadId = uploadId;
  }
}

export class EdgeStoreUploadCanceledError extends EdgeStoreUploadError {
  override readonly name = 'EdgeStoreUploadCanceledError';
}

export class EdgeStoreUploadProcessingTimeoutError extends EdgeStoreUploadError {
  override readonly name = 'EdgeStoreUploadProcessingTimeoutError';
}
