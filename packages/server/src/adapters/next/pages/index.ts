import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type EdgeStoreErrorCodeKey,
  type EdgeStoreRouter,
  type MaybePromise,
  type Provider,
} from '@edgestore/shared';
import { type NextApiRequest, type NextApiResponse } from 'next/types';
import Logger, { type LogLevel } from '../../../libs/logger';
import { EdgeStoreProvider } from '../../../providers/edgestore';
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

export type Config<TCtx> = {
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
  logLevel?: LogLevel;
} & (TCtx extends Record<string, never>
  ? object
  : {
      provider?: Provider;
      router: EdgeStoreRouter<TCtx>;
      createContext: (opts: CreateContextOptions) => MaybePromise<TCtx>;
    });

declare const globalThis: {
  _EDGE_STORE_LOGGER: Logger;
};

export function createEdgeStoreNextHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  const log = new Logger(config.logLevel);
  globalThis._EDGE_STORE_LOGGER = log;
  log.debug('Creating Edge Store Next handler (pages adapter)');

  return async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      if (!('json' in res))
        throw new EdgeStoreError({
          message:
            'Error running the pages adapter. Make sure you are importing the correct adapter in your router configuration',
          code: 'SERVER_ERROR',
        });
      if (req.url?.includes?.('/health')) {
        res.send('OK');
      } else if (req.url?.includes?.('/init')) {
        let ctx = {} as TCtx;
        try {
          ctx =
            'createContext' in config
              ? await config.createContext({ req, res })
              : ({} as TCtx);
        } catch (err) {
          throw new EdgeStoreError({
            message: 'Error creating context',
            code: 'CREATE_CONTEXT_ERROR',
            cause: err instanceof Error ? err : undefined,
          });
        }
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
      } else if (req.url?.includes?.('/request-upload-parts')) {
        res.json(
          await requestUploadParts({
            provider,
            router: config.router,
            body: req.body as RequestUploadPartsParams,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url?.includes?.('/complete-multipart-upload')) {
        await completeMultipartUpload({
          provider,
          router: config.router,
          body: req.body as CompleteMultipartUploadBody,
          ctxToken: req.cookies['edgestore-ctx'],
        });
        res.status(200).end();
      } else if (req.url?.includes?.('/confirm-upload')) {
        res.json(
          await confirmUpload({
            provider,
            router: config.router,
            body: req.body as ConfirmUploadBody,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url?.includes?.('/delete-file')) {
        res.json(
          await deleteFile({
            provider,
            router: config.router,
            body: req.body as DeleteFileBody,
            ctxToken: req.cookies['edgestore-ctx'],
          }),
        );
      } else if (req.url?.includes?.('/proxy-file')) {
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
        log[err.level](err.formattedMessage());
        if (err.cause) log[err.level](err.cause);
        res
          .status(EDGE_STORE_ERROR_CODES[err.code as EdgeStoreErrorCodeKey])
          .json(err.formattedJson());
      } else {
        log.error(err);
        res.status(500).send(
          new EdgeStoreError({
            message: 'Internal Server Error',
            code: 'SERVER_ERROR',
          }).formattedJson(),
        );
      }
    }
  };
}
