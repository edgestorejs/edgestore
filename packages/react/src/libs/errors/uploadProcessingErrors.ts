/** EdgeStore canceled the upload while processing it. */
export class UploadCanceledError extends Error {
  /** The file ID returned by the upload request. */
  readonly id: string;

  constructor(message: string, id: string) {
    super(message);
    this.name = 'UploadCanceledError';
    this.id = id;
  }
}

/**
 * Processing did not finish before `waitForProcessing.timeoutMs`. The upload
 * itself succeeded and may still finish processing.
 */
export class UploadProcessingTimeoutError extends Error {
  /** The file ID returned by the upload request. */
  readonly id: string;

  constructor(message: string, id: string) {
    super(message);
    this.name = 'UploadProcessingTimeoutError';
    this.id = id;
  }
}
