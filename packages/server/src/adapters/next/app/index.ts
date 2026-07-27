import { EdgeStoreError, type MaybePromise } from '@edgestore/shared';
import { type NextRequest } from 'next/server';
import Logger, { type LogLevel } from '../../../libs/logger';
import { dispatchEdgeStoreRequest } from '../../dispatcher';
import { type CookieConfig, type HandlerEdgeStore } from '../../shared';

export type CreateContextOptions = {
  req: NextRequest;
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
  const { cookieConfig } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating EdgeStore Next handler (app adapter)');

  return async (req: NextRequest) => {
    if (!('nextUrl' in req)) {
      const error = new EdgeStoreError({
        message:
          'Error running the app adapter. Make sure you are importing the correct adapter in your router configuration',
        code: 'SERVER_ERROR',
      });
      return Response.json(error.formattedJson(), { status: 500 });
    }

    return await dispatchEdgeStoreRequest({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig,
      request: {
        pathname: req.nextUrl.pathname,
        readJson: () => req.json(),
        getQuery: (name) => req.nextUrl.searchParams.get(name) ?? undefined,
        cookieHeader:
          req.headers?.get('cookie') ?? (req.cookies.toString() || undefined),
        createContext: () =>
          'createContext' in config
            ? config.createContext({ req })
            : ({} as TCtx),
      },
    });
  };
}
