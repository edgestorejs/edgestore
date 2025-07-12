import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type EdgeStoreRouter,
  type MaybePromise,
  type Provider,
} from '@edgestore/shared';
import type { APIContext } from 'astro';
import Logger, { type LogLevel } from '../../libs/logger';
import { matchPath } from '../../libs/utils';
import { EdgeStoreProvider } from '../../providers/edgestore';
import {
  completeMultipartUpload,
  confirmUpload,
  deleteFile,
  getCookieConfig,
  init,
  requestUpload,
  requestUploadParts,
  type CompleteMultipartUploadBody,
  type ConfirmUploadBody,
  type CookieConfig,
  type DeleteFileBody,
  type RequestUploadBody,
  type RequestUploadPartsParams,
} from '../shared';

export type Config<TCtx> = {
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & (TCtx extends Record<string, never>
  ? object
  : {
      provider?: Provider;
      router: EdgeStoreRouter<TCtx>;
      createContext: (opts: APIContext) => MaybePromise<TCtx>;
      cookieConfig?: CookieConfig;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

// Helper to safely get cookies from Astro request
function getCookie(request: Request, name: string): string | undefined {
  const cookieHeader = request.headers.get('cookie');
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

export function createEdgeStoreAstroHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider(), cookieConfig } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Astro handler');

  const resolvedCookieConfig = getCookieConfig(cookieConfig);

  return async (context: APIContext) => {
    try {
      const { request } = context;
      const url = new URL(request.url);

      if (matchPath(url.pathname, 'health')) {
        return new Response('OK');
      } else if (matchPath(url.pathname, 'init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext(context)
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
          cookieConfig,
        });

        const headers = new Headers();
        headers.set('Content-Type', 'application/json');

        // Set cookies
        if (Array.isArray(newCookies)) {
          for (const cookie of newCookies) {
            headers.append('Set-Cookie', cookie);
          }
        } else if (newCookies) {
          headers.append('Set-Cookie', newCookies);
        }

        return new Response(
          JSON.stringify({
            token,
            baseUrl,
          }),
          { headers },
        );
      } else if (matchPath(url.pathname, 'request-upload')) {
        const body = (await request.json()) as RequestUploadBody;
        const result = await requestUpload({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(request, resolvedCookieConfig.ctx.name),
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(url.pathname, 'request-upload-parts')) {
        const body = (await request.json()) as RequestUploadPartsParams;
        const result = await requestUploadParts({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(request, resolvedCookieConfig.ctx.name),
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(url.pathname, 'complete-multipart-upload')) {
        const body = (await request.json()) as CompleteMultipartUploadBody;
        await completeMultipartUpload({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(request, resolvedCookieConfig.ctx.name),
        });

        return new Response(null, { status: 200 });
      } else if (matchPath(url.pathname, 'confirm-upload')) {
        const body = (await request.json()) as ConfirmUploadBody;
        const result = await confirmUpload({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(request, resolvedCookieConfig.ctx.name),
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(url.pathname, 'delete-file')) {
        const body = (await request.json()) as DeleteFileBody;
        const result = await deleteFile({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(request, resolvedCookieConfig.ctx.name),
        });

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (matchPath(url.pathname, 'proxy-file')) {
        const url = new URL(request.url).searchParams.get('url');

        if (typeof url === 'string') {
          const cookieHeader = request.headers.get('cookie') ?? '';

          const proxyRes = await fetch(url, {
            headers: {
              cookie: cookieHeader,
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

        return new Response(JSON.stringify(err.formattedJson()), {
          status: EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey],
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else {
        log.error(err);
        return new Response(
          JSON.stringify(
            new EdgeStoreError({
              message: 'Internal Server Error',
              code: 'SERVER_ERROR',
            }).formattedJson(),
          ),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
      }
    }
  };
}
