import { usageError } from './errors';

export const DEFAULT_API_ORIGIN = 'https://api.edgestore.dev';

export type ResolvedApiUrl = {
  displayUrl: string;
  sdkBaseUrl: string;
};

export function resolveApiUrl(
  flagValue: string | undefined,
  envValue: string | undefined,
): ResolvedApiUrl {
  const rawValue = flagValue ?? envValue ?? DEFAULT_API_ORIGIN;
  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    throw usageError(
      'invalid_api_url',
      `Invalid EdgeStore API URL: ${rawValue}`,
    );
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw usageError(
      'invalid_api_url',
      'The EdgeStore API URL must use http or https.',
    );
  }
  if (url.username || url.password) {
    throw usageError(
      'invalid_api_url',
      'The EdgeStore API URL must not contain credentials.',
    );
  }

  url.search = '';
  url.hash = '';
  const pathname = url.pathname.replace(/\/+$/, '');
  if (pathname !== '' && pathname !== '/v2') {
    throw usageError(
      'invalid_api_url',
      'The EdgeStore API URL must be an origin or end in /v2.',
    );
  }

  url.pathname = '';
  const displayUrl = url.toString().replace(/\/$/, '');

  return {
    displayUrl,
    sdkBaseUrl: `${displayUrl}/v2`,
  };
}
