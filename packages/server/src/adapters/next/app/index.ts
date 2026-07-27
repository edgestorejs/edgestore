import { EdgeStoreError, type AnyContext } from '@edgestore/shared';
import { type NextRequest } from 'next/server';
import Logger, { type LogLevel } from '../../../libs/logger';
import {
  dispatchEdgeStoreRequest,
  resolveContext,
  type CreateContextConfig,
} from '../../dispatcher';
import { type CookieConfig, type HandlerEdgeStore } from '../../shared';

export type CreateContextOptions = {
  req: NextRequest;
};

export type Config<TCtx extends AnyContext> = {
  edgeStore: HandlerEdgeStore<TCtx>;
  logLevel?: LogLevel;
  cookieConfig?: CookieConfig;
} & CreateContextConfig<TCtx, CreateContextOptions>;

export function createEdgeStoreNextHandler<TCtx extends AnyContext>(
  config: Config<TCtx>,
) {
  const { cookieConfig } = config;
  const log = new Logger(config.logLevel);
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

    return await dispatchEdgeStoreRequest<TCtx>({
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
          resolveContext<TCtx, CreateContextOptions>(config, {
            req,
          }),
      },
    });
  };
}
