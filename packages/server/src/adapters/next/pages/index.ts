import { EdgeStoreError, type MaybePromise } from '@edgestore/shared';
import { type NextApiRequest, type NextApiResponse } from 'next/types';
import Logger, { type LogLevel } from '../../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  toNodeDispatchResponse,
} from '../../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../../shared';

export type CreateContextOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
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

export function createEdgeStoreNextHandler<TCtx>(config: Config<TCtx>) {
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Next handler (pages adapter)');

  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!('json' in (res as object))) {
      const error = new EdgeStoreError({
        message:
          'Error running the pages adapter. Make sure you are importing the correct adapter in your router configuration',
        code: 'SERVER_ERROR',
      });
      res.status(500).json(error.formattedJson());
      return;
    }

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
        cookies: req.cookies,
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
    if (normalized.body === undefined) {
      res.end();
      return;
    }
    if (normalized.isJson) res.json(normalized.body);
    else res.end(normalized.body);
  };
}
