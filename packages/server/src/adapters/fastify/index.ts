import { type MaybePromise } from '@edgestore/shared';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import Logger, { type LogLevel } from '../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  toNodeDispatchResponse,
} from '../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../shared';

export type CreateContextOptions = {
  req: FastifyRequest;
  reply: FastifyReply;
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

export function createEdgeStoreFastifyHandler<TCtx>(config: Config<TCtx>) {
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Fastify handler');

  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const url = new URL(req.url, 'http://edgestore.local');
    const response = await dispatchEdgeStoreRequest({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: async () => req.body,
        getQuery: (name) => {
          const value = (req.query as Record<string, unknown>)[name];
          return typeof value === 'string'
            ? value
            : (url.searchParams.get(name) ?? undefined);
        },
        cookieHeader: req.headers.cookie,
        cookies:
          'cookies' in req
            ? (req.cookies as Record<string, string>)
            : undefined,
        createContext: () =>
          'createContext' in config
            ? config.createContext({ req, reply })
            : ({} as TCtx),
      },
    });
    const normalized = await toNodeDispatchResponse(response);
    for (const [name, value] of normalized.headers) {
      void reply.header(name, value);
    }
    void reply.status(normalized.status);
    return reply.send(normalized.body);
  };
}
