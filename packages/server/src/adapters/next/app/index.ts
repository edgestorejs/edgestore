import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type EdgeStoreRouter,
  type MaybePromise,
  type Provider,
} from '@edgestore/shared';
import { type NextRequest } from 'next/server';
import Logger, { type LogLevel } from '../../../libs/logger';
import { matchPath } from '../../../libs/utils';
import { EdgeStoreProvider } from '../../../providers/edgestore';
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
} from '../../shared';

export type CreateContextOptions = {
  req: NextRequest;
};

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
      createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
      cookieConfig?: CookieConfig;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

export function createEdgeStoreNextHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider(), cookieConfig } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Next handler (app adapter)');

  const resolvedCookieConfig = getCookieConfig(cookieConfig);

  return async (req: NextRequest) => {
    try {
      if (!('nextUrl' in req))
        throw new EdgeStoreError({
          message:
            'Error running the app adapter. Make sure you are importing the correct adapter in your router configuration',
          code: 'SERVER_ERROR',
        });

      const pathname = req.nextUrl.pathname;

      if (matchPath(pathname, '/health')) {
        return new Response('OK', {
          status: 200,
        });
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
          cookieConfig,
        });
        const res = new Response(
          JSON.stringify({
            token,
            baseUrl,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        for (const cookie of newCookies) {
          res.headers.append('Set-Cookie', cookie);
        }
        return res;
      } else if (matchPath(pathname, '/request-upload')) {
        const res = await requestUpload({
          provider,
          router: config.router,
          body: (await req.json()) as RequestUploadBody,
          ctxToken: req.cookies.get(resolvedCookieConfig.ctx.name)?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (matchPath(pathname, '/request-upload-parts')) {
        const res = await requestUploadParts({
          provider,
          router: config.router,
          body: (await req.json()) as RequestUploadPartsParams,
          ctxToken: req.cookies.get(resolvedCookieConfig.ctx.name)?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (matchPath(pathname, '/complete-multipart-upload')) {
        await completeMultipartUpload({
          provider,
          router: config.router,
          body: (await req.json()) as CompleteMultipartUploadBody,
          ctxToken: req.cookies.get(resolvedCookieConfig.ctx.name)?.value,
        });
        return new Response(null, {
          status: 200,
        });
      } else if (matchPath(pathname, '/confirm-upload')) {
        const res = await confirmUpload({
          provider,
          router: config.router,
          body: (await req.json()) as ConfirmUploadBody,
          ctxToken: req.cookies.get(resolvedCookieConfig.ctx.name)?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (matchPath(pathname, '/delete-file')) {
        const res = await deleteFile({
          provider,
          router: config.router,
          body: (await req.json()) as DeleteFileBody,
          ctxToken: req.cookies.get(resolvedCookieConfig.ctx.name)?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (matchPath(pathname, '/proxy-file')) {
        const url = req.nextUrl.searchParams.get('url');
        if (typeof url === 'string') {
          const proxyRes = await fetch(url, {
            headers: {
              cookie: req.cookies.toString() ?? '',
            },
          });

          const data = await proxyRes.arrayBuffer();
          return new Response(data, {
            status: proxyRes.status,
            headers: {
              'Content-Type':
                proxyRes.headers.get('Content-Type') ??
                'application/octet-stream',
            },
          });
        } else {
          return new Response(null, {
            status: 400,
          });
        }
      } else {
        return new Response(null, {
          status: 404,
        });
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
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }
  };
}
