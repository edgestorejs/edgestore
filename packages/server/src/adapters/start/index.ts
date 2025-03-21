import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type EdgeStoreRouter,
  type MaybePromise,
  type Provider,
} from '@edgestore/shared';
import Logger, { type LogLevel } from '../../libs/logger';
import { matchPath } from '../../libs/utils';
import { EdgeStoreProvider } from '../../providers/edgestore';
import {
  completeMultipartUpload,
  confirmUpload,
  deleteFile,
  init,
  requestUpload,
  requestUploadParts,
  type CompleteMultipartUploadBody,
  type ConfirmUploadBody,
  type DeleteFileBody,
  type RequestUploadBody,
  type RequestUploadPartsParams,
} from '../shared';

export type CreateContextOptions = {
  req: Request;
};

export type Config<TCtx> = {
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
  logLevel?: LogLevel;
} & (TCtx extends Record<string, never>
  ? object
  : {
      provider?: Provider;
      router: EdgeStoreRouter<TCtx>;
      createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

// Helper to extract a cookie from the request's cookie header
function getCookie(req: Request, cookieName: string): string | undefined {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return undefined;
  return cookieHeader
    .split(';')
    .map((cookieStr) => cookieStr.trim())
    .reduce((acc: Record<string, string>, cookieStr) => {
      const [name, ...rest] = cookieStr.split('=');
      if (name && rest.length > 0) {
        acc[name] = rest.join('=');
      }
      return acc;
    }, {})[cookieName];
}

export function createEdgeStoreStartHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore TanStack Start handler');

  return async ({ request }: { request: Request }) => {
    try {
      const { pathname } = new URL(request.url);
      if (matchPath(pathname, '/health')) {
        return new Response('OK', { status: 200 });
      } else if (matchPath(pathname, '/init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext({ req: request })
              : ({} as TCtx);
        } catch (err) {
          throw new EdgeStoreError({
            message: 'Error creating context',
            code: 'CREATE_CONTEXT_ERROR',
            cause: err instanceof Error ? err : undefined,
          });
        }
        const { newCookies, token, baseUrl } = await init({
          ctx,
          provider,
          router: config.router,
        });
        const headers = new Headers();
        newCookies.forEach((cookie) => headers.append('Set-Cookie', cookie));
        headers.set('Content-Type', 'application/json');
        return new Response(JSON.stringify({ token, baseUrl }), {
          status: 200,
          headers,
        });
      } else if (matchPath(pathname, '/request-upload')) {
        const body = await request.json();
        const ctxToken = getCookie(request, 'edgestore-ctx');
        const result = await requestUpload({
          provider,
          router: config.router,
          body: body as RequestUploadBody,
          ctxToken,
        });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(pathname, '/request-upload-parts')) {
        const body = await request.json();
        const ctxToken = getCookie(request, 'edgestore-ctx');
        const result = await requestUploadParts({
          provider,
          router: config.router,
          body: body as RequestUploadPartsParams,
          ctxToken,
        });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(pathname, '/complete-multipart-upload')) {
        const body = await request.json();
        const ctxToken = getCookie(request, 'edgestore-ctx');
        await completeMultipartUpload({
          provider,
          router: config.router,
          body: body as CompleteMultipartUploadBody,
          ctxToken,
        });
        return new Response(null, { status: 200 });
      } else if (matchPath(pathname, '/confirm-upload')) {
        const body = await request.json();
        const ctxToken = getCookie(request, 'edgestore-ctx');
        const result = await confirmUpload({
          provider,
          router: config.router,
          body: body as ConfirmUploadBody,
          ctxToken,
        });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(pathname, '/delete-file')) {
        const body = await request.json();
        const ctxToken = getCookie(request, 'edgestore-ctx');
        const result = await deleteFile({
          provider,
          router: config.router,
          body: body as DeleteFileBody,
          ctxToken,
        });
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(pathname, '/proxy-file')) {
        const urlParam = new URL(request.url).searchParams.get('url');
        if (typeof urlParam === 'string') {
          const proxyRes = await fetch(urlParam, {
            headers: {
              cookie: request.headers.get('cookie') ?? '',
            },
          });
          const data = await proxyRes.arrayBuffer();
          const headers = new Headers();
          headers.set(
            'Content-Type',
            proxyRes.headers.get('Content-Type') ?? 'application/octet-stream',
          );
          return new Response(data, { status: proxyRes.status, headers });
        } else {
          return new Response(null, { status: 400 });
        }
      } else {
        return new Response(null, { status: 404 });
      }
    } catch (err) {
      if (err instanceof EdgeStoreError) {
        log[err.level](err.formattedMessage());
        if (err.cause) log[err.level](err.cause);
        const status =
          EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey] || 500;
        return new Response(JSON.stringify(err.formattedJson()), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      log.error(err);
      return new Response(
        JSON.stringify(
          new EdgeStoreError({
            message: 'Internal server error',
            code: 'SERVER_ERROR',
          }).formattedJson(),
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
  };
}
