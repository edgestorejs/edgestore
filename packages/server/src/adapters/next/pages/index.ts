import { type NextApiRequest, type NextApiResponse } from 'next/types';
import { type EdgeStoreRouter } from '../../../core/internals/bucketBuilder';
import EdgeStoreError, {
  EDGE_STORE_ERROR_CODES,
} from '../../../libs/errors/EdgeStoreError';
import { EdgeStoreProvider } from '../../../providers/edgestore';
import { type Provider } from '../../../providers/types';
import { type MaybePromise } from '../../../types';
import {
  completeMultipartUpload,
  confirmUpload,
  deleteFile,
  init,
  requestUpload,
  requestUploadParts,
  type CompleteMultipartUploadBody,
  type ConfirmUploadBody,
  type DeleteFileBody,
  type RequestUploadBody,
  type RequestUploadPartsParams,
} from '../../shared';

export type CreateContextOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
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

export function createEdgeStoreNextHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      if (req.url === '/api/edgestore/init') {
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
      } else if (req.url === '/api/edgestore/complete-multipart-upload') {
        await completeMultipartUpload({
          provider,
          router: config.router,
          body: req.body as CompleteMultipartUploadBody,
          ctxToken: req.cookies['edgestore-ctx'],
        });
        res.status(200).end();
      } else if (req.url === '/api/edgestore/confirm-upload') {
        res.json(
          await confirmUpload({
            provider,
            router: config.router,
            body: req.body as ConfirmUploadBody,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url === '/api/edgestore/delete-file') {
        res.json(
          await deleteFile({
            provider,
            router: config.router,
            body: req.body as DeleteFileBody,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url?.startsWith('/api/edgestore/proxy-file')) {
        const { url } = req.query;
        if (typeof url === 'string') {
          const proxyRes = await fetch(url, {
            headers: {
              cookie: req.headers.cookie ?? '',
            },
          });

          const data = await proxyRes.arrayBuffer();
          res.setHeader(
            'Content-Type',
            proxyRes.headers.get('Content-Type') ?? 'application/octet-stream',
          );

          res.end(Buffer.from(data));
        } else {
          res.status(400).end();
        }
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
