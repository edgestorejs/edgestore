import { type AnyRouter } from '@edgestore/shared';
import * as React from 'react';
import { createNextProxy, type BucketFunctions } from './createNextProxy';
import EdgeStoreClientError from './libs/errors/EdgeStoreClientError';
import { handleError } from './libs/errors/handleError';

const DEFAULT_BASE_URL =
  (typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_EDGE_STORE_BASE_URL
    : // @ts-expect-error - In Vite, the env variables are available on `import.meta`.
      import.meta.env?.EDGE_STORE_BASE_URL) ?? 'https://files.edgestore.dev';

type EdgeStoreContextValue<TRouter extends AnyRouter> = {
  edgestore: BucketFunctions<TRouter>;
  /**
   * This will re-run the Edge Store initialization process,
   * which will run the `createContext` function again.
   *
   * Can be used after a sign-in or sign-out, for example.
   */
  reset: () => Promise<void>;
  /**
   * The current state of the Edge Store provider.
   *
   * You can use this to wait for the provider to be initialized
   * before trying to show private images on your app.
   */
  state: ProviderState;
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

type ProviderState =
  | {
      loading: true;
      initialized: false;
      error: false;
    }
  | {
      loading: false;
      initialized: false;
      error: true;
    }
  | {
      loading: false;
      initialized: true;
      error: false;
    };

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
  const [state, setState] = React.useState<ProviderState>({
    loading: true,
    initialized: false,
    error: false,
  });
  const uploadingCountRef = React.useRef(0);
  const initExecuted = React.useRef(false); // to make sure we don't run init twice
  React.useEffect(() => {
    if (!initExecuted.current) {
      void init();
    }

    return () => {
      initExecuted.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function init() {
    try {
      setState({
        loading: true,
        initialized: false,
        error: false,
      });
      const res = await fetch(`${apiPath}/init`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const json = await res.json();
        const innerRes = await fetch(`${DEFAULT_BASE_URL}/_init`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'x-edgestore-token': json.token,
          },
        });
        if (innerRes.ok) {
          // update state
          setState({
            loading: false,
            initialized: true,
            error: false,
          });
        } else {
          setState({
            loading: false,
            initialized: false,
            error: true,
          });
          throw new EdgeStoreClientError("Couldn't initialize Edge Store.");
        }
      } else {
        setState({
          loading: false,
          initialized: false,
          error: true,
        });
        await handleError(res);
      }
    } catch (err) {
      setState({
        loading: false,
        initialized: false,
        error: true,
      });
      throw err;
    }
  }

  async function reset() {
    await init();
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
          reset,
          state,
        }}
      >
        {children}
      </context.Provider>
    </>
  );
}
