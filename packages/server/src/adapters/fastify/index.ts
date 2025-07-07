import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type EdgeStoreRouter,
  type MaybePromise,
  type Provider,
} from '@edgestore/shared';
import { type FastifyReply, type FastifyRequest } from 'fastify';
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

export type CreateContextOptions = {
  req: FastifyRequest;
  reply: FastifyReply;
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

// Helper to safely get cookies from Fastify request
function getCookie(req: FastifyRequest, name: string): string | undefined {
  // Check if cookies plugin is available
  if ('cookies' in req) {
    // Type assertion for TypeScript
    return (req as any).cookies[name];
  }

  // Fallback to parsing cookie header
  const cookieHeader = req.headers.cookie;
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

export function createEdgeStoreFastifyHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider(), cookieConfig } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Fastify handler');

  const resolvedCookieConfig = getCookieConfig(cookieConfig);

  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get the URL from the request - simplified approach
      const pathname = req.url;

      if (matchPath(pathname, '/health')) {
        return reply.send('OK');
      } else if (matchPath(pathname, '/init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext({ req, reply })
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

        // Set cookies more efficiently - handling them using void operator
        // to explicitly mark these synchronous calls as intentionally not awaited
        if (Array.isArray(newCookies)) {
          // If it's an array of cookies, set them all
          for (const cookie of newCookies) {
            void reply.header('Set-Cookie', cookie);
          }
        } else if (newCookies) {
          // If it's a single cookie string
          void reply.header('Set-Cookie', newCookies);
        }

        return reply.send({
          token,
          baseUrl,
        });
      } else if (matchPath(pathname, '/request-upload')) {
        return reply.send(
          await requestUpload({
            provider,
            router: config.router,
            body: req.body as RequestUploadBody,
            ctxToken: getCookie(req, resolvedCookieConfig.ctx.name),
          }),
        );
      } else if (matchPath(pathname, '/request-upload-parts')) {
        return reply.send(
          await requestUploadParts({
            provider,
            router: config.router,
            body: req.body as RequestUploadPartsParams,
            ctxToken: getCookie(req, resolvedCookieConfig.ctx.name),
          }),
        );
      } else if (matchPath(pathname, '/complete-multipart-upload')) {
        await completeMultipartUpload({
          provider,
          router: config.router,
          body: req.body as CompleteMultipartUploadBody,
          ctxToken: getCookie(req, resolvedCookieConfig.ctx.name),
        });
        return reply.status(200).send();
      } else if (matchPath(pathname, '/confirm-upload')) {
        return reply.send(
          await confirmUpload({
            provider,
            router: config.router,
            body: req.body as ConfirmUploadBody,
            ctxToken: getCookie(req, resolvedCookieConfig.ctx.name),
          }),
        );
      } else if (matchPath(pathname, '/delete-file')) {
        return reply.send(
          await deleteFile({
            provider,
            router: config.router,
            body: req.body as DeleteFileBody,
            ctxToken: getCookie(req, resolvedCookieConfig.ctx.name),
          }),
        );
      } else if (matchPath(pathname, '/proxy-file')) {
        const url = req.query
          ? (req.query as Record<string, any>).url
          : undefined;

        if (typeof url === 'string') {
          const cookieHeader = req.headers.cookie ?? '';

          const proxyRes = await fetch(url, {
            headers: {
              cookie: cookieHeader,
            },
          });

          const data = await proxyRes.arrayBuffer();
          void reply.header(
            'Content-Type',
            proxyRes.headers.get('Content-Type') ?? 'application/octet-stream',
          );

          return reply.send(Buffer.from(data));
        } else {
          return reply.status(400).send();
        }
      } else {
        return reply.status(404).send();
      }
    } catch (err) {
      if (err instanceof EdgeStoreError) {
        log[err.level](err.formattedMessage());
        if (err.cause) log[err.level](err.cause);
        return reply
          .status(EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey])
          .send(err.formattedJson());
      } else {
        log.error(err);
        return reply.status(500).send(
          new EdgeStoreError({
            message: 'Internal Server Error',
            code: 'SERVER_ERROR',
          }).formattedJson(),
        );
      }
    }
  };
}
