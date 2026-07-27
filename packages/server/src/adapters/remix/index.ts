import { type AnyContext } from '@edgestore/shared';
import Logger, { type LogLevel } from '../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  resolveContext,
  type CreateContextConfig,
} from '../dispatcher';
import type { CookieConfig, HandlerEdgeStore } from '../shared';

export type CreateContextOptions = {
  req: Request;
};

export type Config<TCtx extends AnyContext> = {
  edgeStore: HandlerEdgeStore<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & CreateContextConfig<TCtx, CreateContextOptions>;

export function createEdgeStoreRemixHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const log = new Logger(config.logLevel);
  log.debug('Creating EdgeStore Remix handler');

  return async ({ request: req }: { request: Request }) => {
    const url = new URL(req.url);
    return await dispatchEdgeStoreRequest<TCtx>({
      edgeStore: config.edgeStore,
      logger: log,
      cookieConfig: config.cookieConfig,
      request: {
        pathname: url.pathname,
        readJson: () => req.json(),
        getQuery: (name) => url.searchParams.get(name) ?? undefined,
        cookieHeader: req.headers.get('cookie') ?? undefined,
        createContext: () =>
          resolveContext<TCtx, CreateContextOptions>(config, {
            req,
          }),
      },
    });
  };
}
