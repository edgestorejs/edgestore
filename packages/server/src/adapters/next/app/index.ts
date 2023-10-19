import { type NextRequest } from 'next/server';
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
      if (req.nextUrl.pathname.endsWith('/init')) {
        const ctx =
          'createContext' in config
            ? await config.createContext({ req })
            : ({} as TCtx);
        const { newCookies, token, baseUrl } = await init({
          ctx,
          provider,
          router: config.router,
        });
        const res = new Response(
          JSON.stringify({
            token,
            baseUrl,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        );
        for (const cookie of newCookies) {
          res.headers.append('Set-Cookie', cookie);
        }
        return res;
      } else if (req.nextUrl.pathname.endsWith('/request-upload')) {
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
      } else if (req.nextUrl.pathname.endsWith('/request-upload-parts')) {
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
      } else if (req.nextUrl.pathname.endsWith('/complete-multipart-upload')) {
        await completeMultipartUpload({
          provider,
          router: config.router,
          body: (await req.json()) as CompleteMultipartUploadBody,
          ctxToken: req.cookies.get('edgestore-ctx')?.value,
        });
        return new Response(null, {
          status: 200,
        });
      } else if (req.nextUrl.pathname.endsWith('/confirm-upload')) {
        const res = await confirmUpload({
          provider,
          router: config.router,
          body: (await req.json()) as ConfirmUploadBody,
          ctxToken: req.cookies.get('edgestore-ctx')?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (req.nextUrl.pathname.endsWith('/delete-file')) {
        const res = await deleteFile({
          provider,
          router: config.router,
          body: (await req.json()) as DeleteFileBody,
          ctxToken: req.cookies.get('edgestore-ctx')?.value,
        });
        return new Response(JSON.stringify(res), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      } else if (req.nextUrl.pathname.endsWith('/proxy-file')) {
        const url = req.nextUrl.searchParams.get('url');
        if (typeof url === 'string') {
          const proxyRes = await fetch(url, {
            headers: {
              cookie: req.cookies.toString() ?? '',
            },
          });

          const data = await proxyRes.arrayBuffer();
          return new Response(data, {
            status: proxyRes.status,
            headers: {
              'Content-Type':
                proxyRes.headers.get('Content-Type') ??
                'application/octet-stream',
            },
          });
        } else {
          return new Response(null, {
            status: 400,
          });
        }
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
