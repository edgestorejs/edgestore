/** Failure returned for a singular `confirm` or `delete` call. */
export class EdgeStoreFileMutationError extends Error {
  override readonly name = 'EdgeStoreFileMutationError';

  constructor(
    readonly code: string,
    message: string,
    readonly fileRef: { url: string },
  ) {
    super(message);
  }
}
