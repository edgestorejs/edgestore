import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type MaybePromise,
} from '@edgestore/shared';
import { type Request, type Response } from 'express';
import Logger, { type LogLevel } from '../../libs/logger';
import { matchPath } from '../../libs/utils';
import {
  completeMultipartUpload,
  confirmUpload,
  deleteFile,
  fetchProxyFile,
  getCookieConfig,
  init,
  requestUpload,
  requestUploadParts,
  type CompleteMultipartUploadBody,
  type ConfirmUploadBody,
  type CookieConfig,
  type DeleteFileBody,
  type HandlerEdgeStore,
  type RequestUploadBody,
  type RequestUploadPartsParams,
} from '../shared';

export type CreateContextOptions = {
  req: Request;
  res: Response;
};

export type Config<TCtx> = {
  edgeStore: HandlerEdgeStore<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & (TCtx extends Record<string, never>
  ? object
  : {
      edgeStore: HandlerEdgeStore<TCtx>;
      createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
      cookieConfig?: CookieConfig;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

export function createEdgeStoreExpressHandler<TCtx>(config: Config<TCtx>) {
  const { provider, router } = config.edgeStore;
  const { cookieConfig } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Express handler');

  const resolvedCookieConfig = getCookieConfig(cookieConfig);

  return async (req: Request, res: Response) => {
    try {
      const pathname = req.url ?? '';
      if (matchPath(pathname, '/health')) {
        res.send('OK');
      } else if (matchPath(pathname, '/init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext({ req, res })
              : ({} as TCtx);
        } catch (err) {
          throw new EdgeStoreError({
            message: 'Error creating context',
            code: 'CREATE_CONTEXT_ERROR',
            cause: err instanceof Error ? err : undefined,
          });
        }
        const { newCookies, ...body } = await init({
          ctx,
          provider,
          router,
          cookieConfig,
        });
        res.setHeader('Set-Cookie', newCookies);
        res.json(body);
      } else if (matchPath(pathname, '/request-upload')) {
        res.json(
          await requestUpload({
            provider,
            router,
            body: req.body as RequestUploadBody,
            ctxToken: req.cookies[resolvedCookieConfig.ctx.name],
          }),
        );
      } else if (matchPath(pathname, '/request-upload-parts')) {
        res.json(
          await requestUploadParts({
            provider,
            router,
            body: req.body as RequestUploadPartsParams,
            ctxToken: req.cookies[resolvedCookieConfig.ctx.name],
          }),
        );
      } else if (matchPath(pathname, '/complete-multipart-upload')) {
        await completeMultipartUpload({
          provider,
          router,
          body: req.body as CompleteMultipartUploadBody,
          ctxToken: req.cookies[resolvedCookieConfig.ctx.name],
        });
        res.status(200).end();
      } else if (matchPath(pathname, '/confirm-upload')) {
        res.json(
          await confirmUpload({
            provider,
            router,
            body: req.body as ConfirmUploadBody,
            ctxToken: req.cookies[resolvedCookieConfig.ctx.name],
          }),
        );
      } else if (matchPath(pathname, '/delete-file')) {
        res.json(
          await deleteFile({
            provider,
            router,
            body: req.body as DeleteFileBody,
            ctxToken: req.cookies[resolvedCookieConfig.ctx.name],
          }),
        );
      } else if (matchPath(pathname, '/proxy-file')) {
        const { url } = req.query;
        if (typeof url === 'string') {
          const proxyRes = await fetchProxyFile({
            cookieHeader: req.headers.cookie,
            url,
          });

          res.setHeader('Content-Type', proxyRes.contentType);
          res.status(proxyRes.status);
          res.end(
            proxyRes.body === null ? undefined : Buffer.from(proxyRes.body),
          );
        } else {
          res.status(400).end();
        }
      } else {
        res.status(404).end();
      }
    } catch (err) {
      if (err instanceof EdgeStoreError) {
        log[err.level](err.formattedMessage());
        if (err.cause) log[err.level](err.cause);
        res
          .status(EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey])
          .json(err.formattedJson());
      } else {
        log.error(err);
        res.status(500).send(
          new EdgeStoreError({
            message: 'Internal Server Error',
            code: 'SERVER_ERROR',
          }).formattedJson(),
        );
      }
    }
  };
}
