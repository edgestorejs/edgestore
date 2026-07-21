import createClient, { type Client } from 'openapi-fetch';
import {
  getAuthorizationHeader,
  type EdgeStoreCredentials,
} from '../credentials';
import {
  EdgeStoreAbortError,
  EdgeStoreApiError,
  EdgeStoreError,
  EdgeStoreNetworkError,
} from '../errors';
import type { paths } from '../generated/api-v2';
import {
  EDGE_STORE_PACKAGE_NAME,
  EDGE_STORE_PACKAGE_VERSION,
} from '../version';

export const DEFAULT_API_URL = 'https://api.edgestore.dev/v2';
export const DEFAULT_CONTROL_TIMEOUT_MS = 30_000;

export type TransportOptions = {
  credentials: EdgeStoreCredentials;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  controlTimeoutMs?: number;
};

type ApiResult<TBody> = {
  data?: TBody;
  error?: unknown;
  response: Response;
};

export type ApiData<TBody> = TBody extends { readonly data: infer Data }
  ? Data
  : TBody;

export type Transport = {
  client: Client<paths>;
  fetch: typeof globalThis.fetch;
  execute<TBody>(
    request: () => Promise<ApiResult<TBody>>,
  ): Promise<ApiData<TBody>>;
  executeWithResponse<TBody>(
    request: () => Promise<ApiResult<TBody>>,
  ): Promise<{ data: ApiData<TBody>; response: Response }>;
};

export function createTransport(options: TransportOptions): Transport {
  const authorization = getAuthorizationHeader(options.credentials);
  const fetch = options.fetch ?? globalThis.fetch;
  const controlTimeoutMs =
    options.controlTimeoutMs ?? DEFAULT_CONTROL_TIMEOUT_MS;
  if (!Number.isFinite(controlTimeoutMs) || controlTimeoutMs < 0) {
    throw new RangeError('controlTimeoutMs must be a non-negative number.');
  }
  const client = createClient<paths>({
    baseUrl: normalizeBaseUrl(options.baseUrl ?? DEFAULT_API_URL),
    fetch: (request) =>
      fetch(
        new Request(request, {
          signal:
            controlTimeoutMs === 0
              ? request.signal
              : AbortSignal.any([
                  request.signal,
                  AbortSignal.timeout(controlTimeoutMs),
                ]),
        }),
      ),
    headers: {
      authorization,
      'user-agent': `${EDGE_STORE_PACKAGE_NAME}/${EDGE_STORE_PACKAGE_VERSION}`,
    },
  });

  const executeWithResponse = async <TBody>(
    request: () => Promise<ApiResult<TBody>>,
  ): Promise<{ data: ApiData<TBody>; response: Response }> => {
    let result: ApiResult<TBody>;

    try {
      result = await request();
    } catch (error) {
      if (error instanceof EdgeStoreError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new EdgeStoreAbortError(undefined, { cause: error });
      }
      throw new EdgeStoreNetworkError(
        'The EdgeStore API request could not be completed.',
        { cause: error },
      );
    }

    if (result.response.ok) {
      return { data: unwrapData(result.data), response: result.response };
    }

    throw createApiError(result.response, result.error);
  };

  return {
    client,
    fetch,
    execute: async (request) => (await executeWithResponse(request)).data,
    executeWithResponse,
  };
}

function unwrapData<TBody>(body: TBody | undefined): ApiData<TBody> {
  if (isRecord(body) && 'data' in body) {
    return body.data as ApiData<TBody>;
  }

  return body as ApiData<TBody>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function createApiError(response: Response, body: unknown): EdgeStoreApiError {
  const payload = getErrorPayload(body);

  return new EdgeStoreApiError({
    message:
      payload?.message ??
      `EdgeStore API request failed with status ${response.status}.`,
    status: response.status,
    code: payload?.code ?? 'unknown_error',
    details: payload?.details,
    requestId: response.headers.get('x-request-id') ?? undefined,
    retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
  });
}

function getErrorPayload(
  body: unknown,
): { code?: string; message?: string; details?: unknown } | undefined {
  if (!isRecord(body) || !isRecord(body.error)) {
    return undefined;
  }

  return {
    code: typeof body.error.code === 'string' ? body.error.code : undefined,
    message:
      typeof body.error.message === 'string' ? body.error.message : undefined,
    details: body.error.details,
  };
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}
