export const EDGE_STORE_ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
} as const;

export type EdgeStoreErrorCodeKey = keyof typeof EDGE_STORE_ERROR_CODES;

class EdgeStoreError extends Error {
  public readonly cause?: Error;
  public readonly code: EdgeStoreErrorCodeKey;

  constructor(opts: {
    message: string;
    code: EdgeStoreErrorCodeKey;
    cause?: Error;
  }) {
    super(opts.message);
    this.name = 'EdgeStoreError';

    this.code = opts.code;
    this.cause = opts.cause;
  }
}

export default EdgeStoreError;
