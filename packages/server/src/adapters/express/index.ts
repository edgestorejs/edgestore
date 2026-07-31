import { type AnyContext } from '@edgestore/shared';
import { type Request, type Response } from 'express';
import Logger, { type LogLevel } from '../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  resolveContext,
  toNodeDispatchResponse,
  type CreateContextConfig,
} from '../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../shared';

export type CreateContextOptions = {
  req: Request;
  res: Response;
};

export type Config<TCtx extends AnyContext> = {
  edgestore: HandlerEdgeStore<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & CreateContextConfig<TCtx, CreateContextOptions>;

export function createEdgeStoreExpressHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const log = new Logger(config.logLevel);
  log.debug('Creating EdgeStore Express handler');

  return async (req: Request, res: Response) => {
    const url = new URL(req.url ?? '', 'http://edgestore.local');
    const response = await dispatchEdgeStoreRequest<TCtx>({
      edgestore: config.edgestore,
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
          resolveContext<TCtx, CreateContextOptions>(config, {
            req,
            res,
          }),
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
