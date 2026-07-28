import {
  EdgeStoreAbortError,
  EdgeStoreApiError,
  EdgeStoreNetworkError,
} from '@edgestore/sdk';

export class CliError extends Error {
  override readonly name = 'CliError';

  constructor(
    readonly code: string,
    message: string,
    readonly options: {
      details?: unknown;
      requestId?: string;
      suggestions?: string[];
      exitCode?: number;
    } = {},
  ) {
    super(message);
  }

  get exitCode(): number {
    return this.options.exitCode ?? 1;
  }
}

const remediation: Record<string, string[]> = {
  authentication_required: ['edgestore login --token'],
  invalid_credential: ['edgestore login --token'],
  credential_not_allowed: [
    'Use a management token instead of a project access key.',
    'edgestore login --token',
  ],
  bucket_not_empty: [
    'edgestore bucket empty <bucket>',
    'edgestore bucket delete <bucket>',
  ],
  bucket_empty_in_progress: ['edgestore bucket empty-status <bucket>'],
};

export function normalizeError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof EdgeStoreApiError) {
    return new CliError(error.code, error.message, {
      details: error.details,
      requestId: error.requestId,
      suggestions: remediation[error.code],
    });
  }

  if (error instanceof EdgeStoreNetworkError) {
    return new CliError('network_error', 'Could not reach the EdgeStore API.', {
      suggestions: [
        'Check your network connection and the configured API URL.',
      ],
    });
  }

  if (error instanceof EdgeStoreAbortError) {
    return new CliError('interrupted', 'Operation canceled.', {
      exitCode: 130,
    });
  }

  if (error instanceof Error) {
    return new CliError('unexpected_error', error.message);
  }

  return new CliError('unexpected_error', 'An unexpected error occurred.');
}

export function usageError(
  code: string,
  message: string,
  suggestions?: string[],
): CliError {
  return new CliError(code, message, {
    suggestions,
    exitCode: 2,
  });
}
