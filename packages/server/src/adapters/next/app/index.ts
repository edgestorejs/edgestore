import { NextRequest } from 'next/server';
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
  req: NextRequest;
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
  return async (req: NextRequest) => {
    try {
      if (req.nextUrl.pathname === '/api/edgestore/init') {
        const ctx =
          'createContext' in config
            ? await config.createContext({ req })
            : ({} as TCtx);
        const { newCookies, token, baseUrl } = await init({
          ctx,
          provider,
          router: config.router,
        });
        return new Response(
          JSON.stringify({
            token,
            baseUrl,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Set-Cookie': newCookies.join('; '),
            },
          },
        );
      } else if (req.nextUrl.pathname === '/api/edgestore/request-upload') {
        const res = await requestUpload({
          provider,
          router: config.router,
          body: (await req.json()) as RequestUploadBody,
          ctxToken: req.cookies.get('edgestore-ctx')?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (
        req.nextUrl.pathname === '/api/edgestore/request-upload-parts'
      ) {
        const res = await requestUploadParts({
          provider,
          router: config.router,
          body: (await req.json()) as RequestUploadPartsParams,
          ctxToken: req.cookies.get('edgestore-ctx')?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (req.nextUrl.pathname === '/api/edgestore/delete-file') {
        await deleteFile({
          provider,
          router: config.router,
          body: (await req.json()) as DeleteFileBody,
          ctxToken: req.cookies.get('edgestore-ctx')?.value,
        });
        return new Response(null, {
          status: 200,
        });
      } else {
        return new Response(null, {
          status: 404,
        });
      }
    } catch (err) {
      if (err instanceof EdgeStoreError) {
        return new Response(err.message, {
          status: EDGE_STORE_ERROR_CODES[err.code],
        });
      } else if (err instanceof Error) {
        return new Response(err.message, {
          status: 500,
        });
      }
      return new Response('Internal server error', {
        status: 500,
      });
    }
  };
}
