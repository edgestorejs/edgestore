import { hkdf } from '@panva/hkdf';
import { serialize } from 'cookie';
import { EncryptJWT, jwtDecrypt } from 'jose';
import { NextApiRequest, NextApiResponse } from 'next/types';
import { v4 as uuidv4 } from 'uuid';
import {
  AnyBuilder,
  BucketPath,
  EdgeStoreRouter,
} from '../../core/internals/bucketBuilder';
import { EdgeStoreProvider } from '../../providers/edgestore';
import { Provider } from '../../providers/types';
import { MaybePromise } from '../../types';

// TODO: change it to 1 hour when we have a way to refresh the token
const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export type CreateNextContextOptions = {
  req: NextApiRequest;
  res: NextApiResponse;
};

export type Config<TCtx> = {
  provider?: Provider;
  router: EdgeStoreRouter<TCtx>;
  createContext: (opts: CreateNextContextOptions) => MaybePromise<TCtx>;
};

type RequestUploadBody = {
  input: any;
  fileInfo: {
    routeName: string;
    size: number;
    extension: string;
    replaceTargetUrl?: string;
  };
};

type DeleteFileBody = {
  routeName: string;
  url: string;
};

export function createEdgeStoreNextHandler<TCtx>(config: Config<TCtx>) {
  const { provider = EdgeStoreProvider() } = config;
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.url === '/api/edgestore/init') {
      const ctx = await config.createContext({ req, res });
      const ctxToken = await encryptJWT(ctx);
      const { token } = await provider.init({
        ctx,
        router: config.router,
      });
      const cookiesToSet = [
        serialize('edgestore-ctx', ctxToken, {
          path: '/',
          maxAge: DEFAULT_MAX_AGE,
        }),
      ];
      if (token) {
        cookiesToSet.push(
          serialize('edgestore-token', token, {
            path: '/',
            maxAge: DEFAULT_MAX_AGE,
          }),
        );
      }
      const baseUrl = provider.getBaseUrl();
      res.setHeader('Set-Cookie', cookiesToSet);
      res.json({
        token,
        baseUrl,
      });
    } else if (req.url === '/api/edgestore/request-upload') {
      const { input, fileInfo } = req.body as RequestUploadBody;
      const ctxToken = req.cookies['edgestore-ctx'];
      if (!ctxToken) {
        res.status(401).send('Missing edgestore-ctx cookie');
        return;
      }
      const ctx = await getContext(ctxToken);
      const route = config.router.routes[fileInfo.routeName];
      if (!route) {
        throw new Error(`Route ${fileInfo.routeName} not found`);
      }
      await route._def.beforeUpload?.({ ctx, input });
      const path = buildPath({
        fileInfo,
        route,
        pathAttrs: { ctx, input },
      });
      const metadata = await route._def.metadata?.({ ctx, input });
      const isPublic = route._def.accessControl === undefined;
      const requestUploadRes = await provider.requestUpload({
        route,
        fileInfo: {
          ...fileInfo,
          path,
          isPublic,
          metadata,
        },
      });
      res.json(requestUploadRes);
    } else if (req.url === '/api/edgestore/delete-file') {
      const { routeName, url } = req.body as DeleteFileBody;
      const ctxToken = req.cookies['edgestore-ctx'];
      if (!ctxToken) {
        res.status(401).send('Missing edgestore-ctx cookie');
        return;
      }
      await getContext(ctxToken); // just to check if the token is valid
      const route = config.router.routes[routeName];
      if (!route) {
        throw new Error(`Route ${routeName} not found`);
      }
      await provider.deleteFile({
        route,
        url,
      });
      res.status(200).end();
    } else {
      res.status(404).end();
    }
  };
}

function buildPath(params: {
  fileInfo: RequestUploadBody['fileInfo'];
  route: AnyBuilder;
  pathAttrs: {
    ctx: any;
    input: any;
  };
}) {
  const { route } = params;
  const pathParams = route._def.path as BucketPath;
  const path = pathParams.map((param) => {
    const paramEntries = Object.entries(param);
    if (paramEntries[0] === undefined) {
      throw new Error('Missing path param');
    }
    const [key, value] = paramEntries[0];
    // this is a string like: "ctx.xxx" or "input.yyy.zzz"
    const currParamVal = value()
      .split('.')
      .reduce((acc2: any, key: string) => {
        if (acc2[key] === undefined) {
          throw new Error(`Missing key ${key} in ${JSON.stringify(acc2)}`);
        }
        return acc2[key];
      }, params.pathAttrs as any) as string;
    return {
      key,
      value: currParamVal,
    };
  });
  return path;
}

async function encryptJWT(ctx: any) {
  const secret = process.env.EDGE_STORE_JWT_SECRET;
  if (!secret) {
    throw new Error('EDGE_STORE_JWT_SECRET is not defined');
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  return await new EncryptJWT(ctx)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(Date.now() / 1000 + DEFAULT_MAX_AGE)
    .setJti(uuidv4())
    .encrypt(encryptionSecret);
}

async function decryptJWT(token: string) {
  const secret = process.env.EDGE_STORE_JWT_SECRET;
  if (!secret) {
    throw new Error('EDGE_STORE_JWT_SECRET is not defined');
  }
  const encryptionSecret = await getDerivedEncryptionKey(secret);
  const { payload } = await jwtDecrypt(token, encryptionSecret, {
    clockTolerance: 15,
  });
  return payload;
}

async function getDerivedEncryptionKey(secret: string) {
  return await hkdf(
    'sha256',
    secret,
    '',
    'Edge Store Generated Encryption Key',
    32,
  );
}

async function getContext(token?: string) {
  if (!token) {
    throw new Error('No token');
  }
  return await decryptJWT(token);
}
