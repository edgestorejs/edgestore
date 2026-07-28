import {
  EDGE_STORE_ERROR_CODES,
  EdgeStoreError,
  type AnyContext,
  type EdgeStoreErrorCodeKey,
  type MaybePromise,
} from '@edgestore/shared';
import { parse } from 'cookie';
import { type z } from 'zod';
import type { LoggerLike } from '../libs/logger';
import { matchPath } from '../libs/utils';
import {
  completeMultipartUpload,
  completeMultipartUploadBodySchema,
  confirmUploads,
  confirmUploadsBodySchema,
  deleteFiles,
  deleteFilesBodySchema,
  fetchProxyFile,
  getCookieConfig,
  init,
  requestUpload,
  requestUploadBodySchema,
  requestUploadParts,
  requestUploadPartsBodySchema,
  type CookieConfig,
  type HandlerEdgeStore,
} from './shared';

export type EdgeStoreDispatchRequest<TCtx extends AnyContext> = {
  pathname: string;
  readJson: () => Promise<unknown>;
  getQuery: (name: string) => string | undefined;
  cookieHeader?: string;
  cookies?: Readonly<Record<string, string | undefined>>;
  createContext: () => MaybePromise<TCtx>;
};

export type CreateContextConfig<TCtx extends AnyContext, TOptions> =
  TCtx extends Record<string, never>
    ? {
        createContext?: (options: TOptions) => MaybePromise<TCtx>;
      }
    : {
        createContext: (options: TOptions) => MaybePromise<TCtx>;
      };

export function resolveContext<TCtx extends AnyContext, TOptions>(
  config: object,
  options: TOptions,
): MaybePromise<TCtx> {
  return hasCreateContext<TCtx, TOptions>(config)
    ? config.createContext(options)
    : ({} as TCtx);
}

function hasCreateContext<TCtx extends AnyContext, TOptions>(
  config: object,
): config is {
  createContext: (options: TOptions) => MaybePromise<TCtx>;
} {
  return (
    'createContext' in config && typeof config.createContext === 'function'
  );
}

export async function dispatchEdgeStoreRequest<
  TCtx extends AnyContext,
>(params: {
  edgeStore: HandlerEdgeStore<TCtx>;
  request: EdgeStoreDispatchRequest<TCtx>;
  logger: LoggerLike;
  cookieConfig?: CookieConfig;
}): Promise<Response> {
  const { edgeStore, request, logger, cookieConfig } = params;
  const { provider, router } = edgeStore;
  const resolvedCookieConfig = getCookieConfig(cookieConfig);
  const cookieHeader =
    request.cookieHeader ??
    Object.entries(request.cookies ?? {})
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  const ctxToken =
    request.cookies?.[resolvedCookieConfig.ctx.name] ??
    (cookieHeader
      ? parse(cookieHeader)[resolvedCookieConfig.ctx.name]
      : undefined);

  try {
    if (matchPath(request.pathname, '/health')) {
      return new Response('OK');
    }

    if (matchPath(request.pathname, '/init')) {
      let ctx: TCtx;
      try {
        ctx = await request.createContext();
      } catch (error) {
        throw new EdgeStoreError({
          message: 'Error creating context',
          code: 'CREATE_CONTEXT_ERROR',
          cause: error instanceof Error ? error : undefined,
        });
      }
      const { newCookies, ...body } = await init({
        ctx,
        provider,
        router,
        logger,
        cookieConfig,
      });
      const headers = new Headers({ 'Content-Type': 'application/json' });
      for (const cookie of newCookies) headers.append('Set-Cookie', cookie);
      return new Response(JSON.stringify(body), { status: 200, headers });
    }

    if (matchPath(request.pathname, '/request-upload')) {
      return jsonResponse(
        await requestUpload({
          provider,
          router,
          body: await parseRequestBody(request, requestUploadBodySchema),
          ctxToken,
          logger,
        }),
      );
    }

    if (matchPath(request.pathname, '/request-upload-parts')) {
      return jsonResponse(
        await requestUploadParts({
          provider,
          router,
          body: await parseRequestBody(request, requestUploadPartsBodySchema),
          ctxToken,
          logger,
        }),
      );
    }

    if (matchPath(request.pathname, '/complete-multipart-upload')) {
      await completeMultipartUpload({
        provider,
        router,
        body: await parseRequestBody(
          request,
          completeMultipartUploadBodySchema,
        ),
        ctxToken,
        logger,
      });
      return new Response(null, { status: 200 });
    }

    if (matchPath(request.pathname, '/confirm-uploads')) {
      return jsonResponse(
        await confirmUploads({
          provider,
          router,
          body: await parseRequestBody(request, confirmUploadsBodySchema),
          ctxToken,
          logger,
        }),
      );
    }

    if (matchPath(request.pathname, '/delete-files')) {
      return jsonResponse(
        await deleteFiles({
          provider,
          router,
          body: await parseRequestBody(request, deleteFilesBodySchema),
          ctxToken,
          logger,
        }),
      );
    }

    if (matchPath(request.pathname, '/proxy-file')) {
      const url = request.getQuery('url');
      if (url === undefined) return new Response(null, { status: 400 });
      const result = await fetchProxyFile({
        cookieHeader,
        url,
      });
      return new Response(result.body, {
        status: result.status,
        headers: { 'Content-Type': result.contentType },
      });
    }

    return new Response(null, { status: 404 });
  } catch (error) {
    if (error instanceof EdgeStoreError) {
      logger[error.level](error.formattedMessage());
      if (error.cause) logger[error.level](error.cause);
      return jsonResponse(
        error.formattedJson(),
        EDGE_STORE_ERROR_CODES[error.code as EdgeStoreErrorCodeKey],
      );
    }

    logger.error(error);
    return jsonResponse(
      new EdgeStoreError({
        message: 'Internal server error',
        code: 'SERVER_ERROR',
      }).formattedJson(),
      500,
    );
  }
}

export async function toNodeDispatchResponse(response: Response) {
  const contentType = response.headers.get('Content-Type') ?? '';
  const headers: [string, string | string[]][] = [];
  response.headers.forEach((value, name) => {
    if (name !== 'set-cookie') {
      headers.push([name === 'content-type' ? 'Content-Type' : name, value]);
    }
  });
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length > 0) headers.push(['Set-Cookie', setCookies]);

  return {
    status: response.status,
    headers,
    isJson: contentType.includes('application/json'),
    body:
      response.body === null
        ? undefined
        : contentType.includes('application/json')
          ? await response.json()
          : contentType.startsWith('text/')
            ? await response.text()
            : Buffer.from(await response.arrayBuffer()),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function parseRequestBody<TSchema extends z.ZodTypeAny>(
  request: EdgeStoreDispatchRequest<AnyContext>,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  try {
    return await schema.parseAsync(await request.readJson());
  } catch (error) {
    throw new EdgeStoreError({
      message: 'Invalid request body',
      code: 'BAD_REQUEST',
      cause: error instanceof Error ? error : undefined,
    });
  }
}
