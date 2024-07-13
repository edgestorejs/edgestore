export class UploadAbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadAbortedError';
  }
}
