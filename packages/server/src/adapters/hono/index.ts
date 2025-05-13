import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type EdgeStoreRouter,
  type MaybePromise,
  type Provider,
} from '@edgestore/shared';
import { type Context } from 'hono';
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
  c: Context;
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

// Helper to get a cookie value from Hono Context
function getCookie(c: Context, name: string): string | undefined {
  const cookies = c.req.header('cookie');
  if (!cookies) return undefined;

  const match = new RegExp(`${name}=([^;]+)`).exec(cookies);
  return match ? match[1] : undefined;
}

export function createEdgeStoreHonoHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Hono handler');

  return async (c: Context) => {
    try {
      const pathname = new URL(c.req.url).pathname;

      if (matchPath(pathname, '/health')) {
        return c.text('OK');
      } else if (matchPath(pathname, '/init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext({ c })
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

        // Set cookies
        if (Array.isArray(newCookies)) {
          for (const cookie of newCookies) {
            c.header('Set-Cookie', cookie);
          }
        } else if (newCookies) {
          c.header('Set-Cookie', newCookies);
        }

        return c.json({
          token,
          baseUrl,
        });
      } else if (matchPath(pathname, '/request-upload')) {
        const body = await c.req.json<RequestUploadBody>();
        return c.json(
          await requestUpload({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(c, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/request-upload-parts')) {
        const body = await c.req.json<RequestUploadPartsParams>();
        return c.json(
          await requestUploadParts({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(c, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/complete-multipart-upload')) {
        const body = await c.req.json<CompleteMultipartUploadBody>();
        await completeMultipartUpload({
          provider,
          router: config.router,
          body,
          ctxToken: getCookie(c, 'edgestore-ctx'),
        });
        return c.body(null, 200);
      } else if (matchPath(pathname, '/confirm-upload')) {
        const body = await c.req.json<ConfirmUploadBody>();
        return c.json(
          await confirmUpload({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(c, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/delete-file')) {
        const body = await c.req.json<DeleteFileBody>();
        return c.json(
          await deleteFile({
            provider,
            router: config.router,
            body,
            ctxToken: getCookie(c, 'edgestore-ctx'),
          }),
        );
      } else if (matchPath(pathname, '/proxy-file')) {
        const url = c.req.query('url');

        if (typeof url === 'string') {
          const cookieHeader = c.req.header('cookie') ?? '';

          const proxyRes = await fetch(url, {
            headers: {
              cookie: cookieHeader,
            },
          });

          const data = await proxyRes.arrayBuffer();
          c.header(
            'Content-Type',
            proxyRes.headers.get('Content-Type') ?? 'application/octet-stream',
          );

          return c.body(Buffer.from(data));
        } else {
          return c.body(null, 400);
        }
      } else {
        return c.body(null, 404);
      }
    } catch (err) {
      if (err instanceof EdgeStoreError) {
        log[err.level](err.formattedMessage());
        if (err.cause) log[err.level](err.cause);
        return c.json(
          err.formattedJson(),
          EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey],
        );
      } else {
        log.error(err);
        return c.json(
          new EdgeStoreError({
            message: 'Internal Server Error',
            code: 'SERVER_ERROR',
          }).formattedJson(),
          500,
        );
      }
    }
  };
}
