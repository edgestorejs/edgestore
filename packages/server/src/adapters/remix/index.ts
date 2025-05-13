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

// Helper to safely get cookies from Remix request
function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return undefined;

  const cookies = cookieHeader
    .split(';')
    .reduce<Record<string, string>>((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) acc[key] = value;
      return acc;
    }, {});

  return cookies[name];
}

export function createEdgeStoreRemixHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Remix handler');

  return async ({ request: req }: { request: Request }) => {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname;

      if (matchPath(pathname, '/health')) {
        return new Response('OK');
      } else if (matchPath(pathname, '/init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext({ req })
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

        // Create response with cookies and token
        const responseHeaders = new Headers();

        if (Array.isArray(newCookies)) {
          for (const cookie of newCookies) {
            responseHeaders.append('Set-Cookie', cookie);
          }
        } else if (newCookies) {
          responseHeaders.append('Set-Cookie', newCookies);
        }

        return new Response(JSON.stringify({ token, baseUrl }), {
          headers: responseHeaders,
          status: 200,
        });
      } else if (matchPath(pathname, '/request-upload')) {
        const body = (await req.json()) as RequestUploadBody;
        return Response.json(
          await requestUpload({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(req, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/request-upload-parts')) {
        const body = (await req.json()) as RequestUploadPartsParams;
        return Response.json(
          await requestUploadParts({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(req, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/complete-multipart-upload')) {
        const body = (await req.json()) as CompleteMultipartUploadBody;
        await completeMultipartUpload({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(req, 'edgestore-ctx'),
        });
        return new Response(null, { status: 200 });
      } else if (matchPath(pathname, '/confirm-upload')) {
        const body = (await req.json()) as ConfirmUploadBody;
        return Response.json(
          await confirmUpload({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(req, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/delete-file')) {
        const body = (await req.json()) as DeleteFileBody;
        return Response.json(
          await deleteFile({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(req, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/proxy-file')) {
        const url = new URL(req.url).searchParams.get('url');
        if (typeof url === 'string') {
          const proxyRes = await fetch(url, {
            headers: {
              cookie: req.headers.get('cookie') ?? '',
            },
          });

          const data = await proxyRes.arrayBuffer();
          const headers = new Headers();
          headers.set(
            'Content-Type',
            proxyRes.headers.get('Content-Type') ?? 'application/octet-stream',
          );

          return new Response(data, { headers });
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
        return Response.json(err.formattedJson(), {
          status: EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey],
        });
      } else {
        log.error(err);
        return Response.json(
          new EdgeStoreError({
            message: 'Internal Server Error',
            code: 'SERVER_ERROR',
          }).formattedJson(),
          { status: 500 },
        );
      }
    }
  };
}
