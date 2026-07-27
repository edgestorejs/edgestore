import { type MaybePromise } from '@edgestore/shared';
import { type Request, type Response } from 'express';
import Logger, { type LogLevel } from '../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  toNodeDispatchResponse,
} from '../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../shared';

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
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Express handler');

  return async (req: Request, res: Response) => {
    const url = new URL(req.url ?? '', 'http://edgestore.local');
    const response = await dispatchEdgeStoreRequest({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: async () => req.body,
        getQuery: (name) => {
          const value = req.query[name];
          return typeof value === 'string'
            ? value
            : (url.searchParams.get(name) ?? undefined);
        },
        cookieHeader: req.headers.cookie,
        cookies: req.cookies as Record<string, string>,
        createContext: () =>
          'createContext' in config
            ? config.createContext({ req, res })
            : ({} as TCtx),
      },
    });
    const normalized = await toNodeDispatchResponse(response);
    for (const [name, value] of normalized.headers) {
      res.setHeader(name, value);
    }
    res.status(normalized.status);
    if (normalized.body === undefined) return res.end();
    return normalized.isJson
      ? res.json(normalized.body)
      : res.end(normalized.body);
  };
}
