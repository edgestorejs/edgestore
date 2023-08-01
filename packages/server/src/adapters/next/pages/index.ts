import { NextApiRequest, NextApiResponse } from 'next/types';
import { EdgeStoreRouter } from '../../../core/internals/bucketBuilder';
import EdgeStoreError, {
  EDGE_STORE_ERROR_CODES,
} from '../../../libs/errors/EdgeStoreError';
import { EdgeStoreProvider } from '../../../providers/edgestore';
import { Provider } from '../../../providers/types';
import { MaybePromise } from '../../../types';
import {
  deleteFile,
  DeleteFileBody,
  init,
  requestUpload,
  RequestUploadBody,
  requestUploadParts,
  RequestUploadPartsParams,
} from '../../shared';

export type CreateContextOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
};

export type Config<TCtx> = {
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
  createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
};

export function createEdgeStoreNextHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      if (req.url === '/api/edgestore/init') {
        const ctx = await config.createContext({ req, res });
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
      } else if (req.url === '/api/edgestore/request-upload') {
        res.json(
          await requestUpload({
            provider,
            router: config.router,
            body: req.body as RequestUploadBody,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url === '/api/edgestore/request-upload-parts') {
        res.json(
          await requestUploadParts({
            provider,
            router: config.router,
            body: req.body as RequestUploadPartsParams,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url === '/api/edgestore/delete-file') {
        await deleteFile({
          provider,
          router: config.router,
          body: req.body as DeleteFileBody,
          ctxToken: req.cookies['edgestore-ctx'],
        });
        res.status(200).end();
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
