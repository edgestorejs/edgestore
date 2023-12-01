import { type Request, type Response } from 'express';
import { type EdgeStoreRouter } from '../../core/internals/bucketBuilder';
import EdgeStoreError, {
  EDGE_STORE_ERROR_CODES,
} from '../../libs/errors/EdgeStoreError';
import { EdgeStoreProvider } from '../../providers/edgestore';
import { type Provider } from '../../providers/types';
import { type MaybePromise } from '../../types';
import { init, requestUpload, type RequestUploadBody } from '../shared';

export type CreateContextOptions = {
  req: Request;
  res: Response;
};

export type Config<TCtx> = TCtx extends Record<string, never>
  ? {
      provider?: Provider;
      router: EdgeStoreRouter<TCtx>;
    }
  : {
      provider?: Provider;
      router: EdgeStoreRouter<TCtx>;
      createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
    };

export function createEdgeStoreExpressHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  return async (req: Request, res: Response) => {
    try {
      if (req.url?.includes?.('/init')) {
        const ctx =
          'createContext' in config
            ? await config.createContext({ req, res })
            : ({} as TCtx);
        const { newCookies, token, baseUrl } = await init({
          ctx,
          provider,
          router: config.router,
        });
        res.setHeader('Set-Cookie', newCookies);
        res.json({
          token,
          baseUrl,
        });
      } else if (req.url?.includes?.('/request-upload')) {
        res.json(
          await requestUpload({
            provider,
            router: config.router,
            body: req.body as RequestUploadBody,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else {
        res.status(404).end();
      }
    } catch (err) {
      if (err instanceof EdgeStoreError) {
        res.status(EDGE_STORE_ERROR_CODES[err.code]).send(err.message);
      } else if (err instanceof Error) {
        res.status(500).send(err.message);
      }
      res.status(500).send('Internal server error');
    }
  };
}
