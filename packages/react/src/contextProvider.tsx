import { type AnyRouter } from '@edgestore/server/core';
import * as React from 'react';
import { createNextProxy, type BucketFunctions } from './createNextProxy';

const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_EDGE_STORE_BASE_URL ?? 'https://files.edgestore.dev';

type EdgeStoreContextValue<TRouter extends AnyRouter> = {
  edgestore: BucketFunctions<TRouter>;
  /**
   * In development, if this is a protected file, this function will add the token as a query param to the url.
   * This is needed because third party cookies don't work with http urls.
   */
  getSrc: (url: string) => string;
};

export function createEdgeStoreProvider<TRouter extends AnyRouter>(opts?: {
  /**
   * The maximum number of concurrent uploads.
   *
   * Uploads will automatically be queued if this limit is reached.
   *
   * @default 5
   */
  maxConcurrentUploads?: number;
}) {
  const EdgeStoreContext = React.createContext<
    EdgeStoreContextValue<TRouter> | undefined
  >(undefined);

  const EdgeStoreProvider = ({
    children,
    basePath,
  }: {
    children: React.ReactNode;
    /**
     * In case your app is not hosted at the root of your domain, you can specify the base path here.
     * If you set this, make sure to set the full path to the EdgeStore API.
     * e.g. `/my-app/api/edgestore` or `https://example.com/my-app/api/edgestore`
     *
     * @example - If your app is hosted at `https://example.com/my-app`, you can set the `basePath` to `/my-app/api/edgestore`.
     */
    basePath?: string;
  }) => {
    return EdgeStoreProviderInner<TRouter>({
      children,
      context: EdgeStoreContext,
      basePath,
      maxConcurrentUploads: opts?.maxConcurrentUploads,
    });
  };

  function useEdgeStore() {
    if (!EdgeStoreContext) {
      throw new Error('React Context is unavailable in Server Components');
    }

    // @ts-expect-error - We know that the context value should not be undefined
    const value: EdgeStoreContextValue<TRouter> =
      React.useContext(EdgeStoreContext);
    if (!value && process.env.NODE_ENV !== 'production') {
      throw new Error(
        '[edgestore]: `useEdgeStore` must be wrapped in a <EdgeStoreProvider />',
      );
    }

    return value;
  }

  return {
    EdgeStoreProvider,
    useEdgeStore,
  };
}

function EdgeStoreProviderInner<TRouter extends AnyRouter>({
  children,
  context,
  basePath,
  maxConcurrentUploads,
}: {
  children: React.ReactNode;
  context: React.Context<EdgeStoreContextValue<TRouter> | undefined>;
  basePath?: string;
  maxConcurrentUploads?: number;
}) {
  const apiPath = basePath ? `${basePath}` : '/api/edgestore';
  const [token, setToken] = React.useState<string | null>(null);
  const uploadingCountRef = React.useRef(0);
  React.useEffect(() => {
    void fetch(`${apiPath}/init`, {
      method: 'POST',
    }).then(async (res) => {
      if (res.ok) {
        const json = await res.json();
        setToken(json.token);
        await fetch(`${DEFAULT_BASE_URL}/_init`, {
          method: 'GET',
          headers: {
            'x-edgestore-token': json.token,
          },
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getSrc(url: string) {
    if (
      // in production we use cookies, so we don't need a token
      process.env.NODE_ENV === 'production' ||
      // public urls don't need a token
      // e.g. https://files.edgestore.dev/project/bucket/_public/...
      url.match(/^https?:\/\/[^\/]+\/[^\/]+\/[^\/]+\/_public\/.+/)
    ) {
      return `${url}`;
    } else {
      // in development, third party cookies don't work, so we need to pass the token as a query param
      const uri = new URL(url);
      uri.searchParams.set('token', token ?? '');
      return `${uri}`;
    }
  }

  return (
    <>
      <context.Provider
        value={{
          edgestore: createNextProxy<TRouter>({
            apiPath,
            uploadingCountRef,
            maxConcurrentUploads,
          }),
          getSrc,
        }}
      >
        {children}
      </context.Provider>
    </>
  );
}
