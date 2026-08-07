import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { CliError } from './errors';

const LOOPBACK_HOST = '127.0.0.1';
const CALLBACK_PATH = '/oauth/callback';
const CALLBACK_TIMEOUT_MS = 10 * 60 * 1_000;

export type OAuthCallbackServer = {
  redirectUri: string;
  callback: Promise<URL>;
  close(): Promise<void>;
};

export async function openOAuthCallbackServer(
  expectedState: string,
  signal: AbortSignal,
  preferredRedirectUri?: string,
): Promise<OAuthCallbackServer> {
  const preferred = preferredRedirectUri
    ? reusableRedirectUrl(preferredRedirectUri)
    : undefined;
  const server = createServer();
  await listen(server, preferred?.port ? Number(preferred.port) : 0);

  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new CliError(
      'oauth_callback_unavailable',
      'Could not start the local OAuth callback server.',
    );
  }

  const redirectUrl = new URL(
    preferred?.pathname ?? CALLBACK_PATH,
    `http://${LOOPBACK_HOST}:${address.port}`,
  );
  const pendingCallback = waitForCallback(server, redirectUrl, {
    expectedState,
    signal,
  });
  void pendingCallback.promise.catch(() => undefined);

  return {
    redirectUri: redirectUrl.toString(),
    callback: pendingCallback.promise,
    async close() {
      pendingCallback.cancel();
      await closeServer(server);
    },
  };
}

export function isReusableOAuthRedirectUri(value: string): boolean {
  return reusableRedirectUrl(value) !== undefined;
}

function reusableRedirectUrl(value: string): URL | undefined {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'http:' ||
      url.hostname !== LOOPBACK_HOST ||
      !url.port ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen({ host: LOOPBACK_HOST, port });
  });
}

function waitForCallback(
  server: Server,
  redirectUrl: URL,
  options: { expectedState: string; signal: AbortSignal },
): { promise: Promise<URL>; cancel(): void } {
  let cancel: () => void = () => undefined;
  const promise = new Promise<URL>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      finish(
        new CliError(
          'oauth_login_timeout',
          'Browser login timed out before authorization completed.',
          { suggestions: ['edgestore login', 'edgestore login --token'] },
        ),
      );
    }, CALLBACK_TIMEOUT_MS);
    const onAbort = () =>
      finish(
        options.signal.reason instanceof Error
          ? options.signal.reason
          : abortError(),
      );

    const finish = (error?: unknown, callbackUrl?: URL) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      options.signal.removeEventListener('abort', onAbort);
      server.removeListener('request', onRequest);
      if (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      } else resolve(callbackUrl!);
    };
    cancel = () => finish(abortError());

    const onRequest = (request: IncomingMessage, response: ServerResponse) => {
      const callbackUrl = new URL(request.url ?? '/', redirectUrl);
      if (
        request.method !== 'GET' ||
        callbackUrl.pathname !== redirectUrl.pathname
      ) {
        response.writeHead(404, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Not found');
        return;
      }
      if (callbackUrl.searchParams.get('state') !== options.expectedState) {
        response.writeHead(400, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end(
          'Invalid OAuth state. Return to the terminal and try again.',
        );
        return;
      }

      response.writeHead(200, {
        connection: 'close',
        'content-type': 'text/html; charset=utf-8',
      });
      response.end(
        callbackUrl.searchParams.has('error')
          ? authorizationFailedPage
          : authorizationReceivedPage,
      );
      finish(undefined, callbackUrl);
    };

    server.on('request', onRequest);
    if (options.signal.aborted) onAbort();
    else options.signal.addEventListener('abort', onAbort, { once: true });
  });
  return { promise, cancel };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

const authorizationReceivedPage = callbackPage(
  'EdgeStore authorization received',
  'Authorization received',
  'Return to the terminal to finish logging in.',
);

const authorizationFailedPage = callbackPage(
  'EdgeStore login not completed',
  'Login was not completed',
  'Return to the terminal for details or to try again.',
);

function callbackPage(title: string, heading: string, message: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.5 system-ui, sans-serif; color: #18181b; background: #fafafa; }
      main { width: min(32rem, calc(100% - 3rem)); }
      h1 { margin: 0 0 .5rem; font-size: 1.75rem; letter-spacing: 0; }
      p { margin: 0; color: #52525b; }
    </style>
  </head>
  <body><main><h1>${heading}</h1><p>${message}</p></main></body>
</html>`;
}
