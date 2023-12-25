import { type Simplify } from '../types';

/* eslint-disable @typescript-eslint/no-non-null-assertion */
export const EDGE_STORE_ERROR_CODES = {
  BAD_REQUEST: 400,
  FILE_TOO_LARGE: 400,
  MIME_TYPE_NOT_ALLOWED: 400,
  UNAUTHORIZED: 401,
  UPLOAD_NOT_ALLOWED: 403,
  DELETE_NOT_ALLOWED: 403,
  CREATE_CONTEXT_ERROR: 500,
  SERVER_ERROR: 500,
} as const;

export type EdgeStoreErrorCodeKey = keyof typeof EDGE_STORE_ERROR_CODES;

export type EdgeStoreErrorDetails<TCode extends EdgeStoreErrorCodeKey> =
  TCode extends 'FILE_TOO_LARGE'
    ? {
        maxFileSize: number;
        fileSize: number;
      }
    : TCode extends 'MIME_TYPE_NOT_ALLOWED'
    ? {
        allowedMimeTypes: string[];
        mimeType: string;
      }
    : never;

export type EdgeStoreJsonResponse = Simplify<
  | {
      message: string;
      code: 'FILE_TOO_LARGE';
      details: EdgeStoreErrorDetails<'FILE_TOO_LARGE'>;
    }
  | {
      message: string;
      code: 'MIME_TYPE_NOT_ALLOWED';
      details: EdgeStoreErrorDetails<'MIME_TYPE_NOT_ALLOWED'>;
    }
  | {
      message: string;
      code: Exclude<
        EdgeStoreErrorCodeKey,
        'FILE_TOO_LARGE' | 'MIME_TYPE_NOT_ALLOWED'
      >;
    }
>;

export class EdgeStoreError<TCode extends EdgeStoreErrorCodeKey> extends Error {
  public readonly cause?: Error;
  public readonly code: TCode;
  public readonly level: 'error' | 'warn';
  public readonly details: EdgeStoreErrorDetails<TCode>;

  constructor(
    opts: {
      message: string;
      code: TCode;
      cause?: Error;
    } & (EdgeStoreErrorDetails<TCode> extends undefined
      ? object
      : {
          details: EdgeStoreErrorDetails<TCode>;
        }),
  ) {
    super(opts.message);
    this.name = 'EdgeStoreError';

    this.code = opts.code;
    this.cause = opts.cause;
    this.level = EDGE_STORE_ERROR_CODES[opts.code] >= 500 ? 'error' : 'warn';
    this.details = 'details' in opts ? opts.details : undefined!;
  }

  formattedMessage(): string {
    return `${this.message}${
      this.details ? `\n    Details: ${JSON.stringify(this.details)}` : ''
    }${this.cause ? `\n    Caused by: ${this.cause.message}` : ''}`;
  }

  formattedJson(): EdgeStoreJsonResponse {
    return {
      message:
        this.code === 'SERVER_ERROR' ? 'Internal server error' : this.message,
      code: this.code,
      details: this.details as any,
    } satisfies EdgeStoreJsonResponse;
  }
}
