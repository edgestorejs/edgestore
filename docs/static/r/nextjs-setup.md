# EdgeStore Minimal Setup for Next.js

EdgeStore simplifies file uploads with storage, CDN, and a type-safe library.

## Installation

Install the required packages:

```bash
npm install @edgestore/server @edgestore/react zod
```

or

```bash
pnpm add @edgestore/server @edgestore/react zod
```
or

```bash
bun add @edgestore/server @edgestore/react zod
```

or

```bash
yarn add @edgestore/server @edgestore/react zod
```

## Environment Variables

1.  Go to your EdgeStore [Dashboard](https://dashboard.edgestore.dev/).
2.  Create a new project.
3.  Copy the keys to your environment variables.

```
.env
EDGE_STORE_ACCESS_KEY=your-access-key
EDGE_STORE_SECRET_KEY=your-secret-key
```

**Caution:** Add `.env` to your `.gitignore` file to avoid committing your secret keys.

## Backend

Edge Store is compatible with both Next.js Pages Router and App Router.

### App Router

Create the backend code:

```ts
src/app/api/edgestore/[...edgestore]/route.ts

import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';

const es = initEdgeStore.create();

/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;
```

### Pages Router

Create the backend code:

```tsx
src/pages/api/edgestore/[...edgestore].ts

import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/pages';

const es = initEdgeStore.create();

/**
 * This is the main router for the edgestore buckets.
 */
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export default createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;
```

## Frontend

Initiate the context provider.

### App Router

```tsx
src/lib/edgestore.ts

'use client';

import { type EdgeStoreRouter } from '../app/api/edgestore/[...edgestore]/route';
import { createEdgeStoreProvider } from '@edgestore/react';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
```

### Pages Router

```tsx
src/lib/edgestore.ts

'use client';

import { createEdgeStoreProvider } from '@edgestore/react';
import { type EdgeStoreRouter } from '../pages/api/edgestore/[...edgestore]';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
```

Wrap your app with the provider.

### App Router

```tsx
src/app/layout.tsx

import { EdgeStoreProvider } from '../lib/edgestore';
import './globals.css';

// ...

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <EdgeStoreProvider>{children}</EdgeStoreProvider>
      </body>
    </html>
  );
}
```

### Pages Router

```tsx
src/pages/_app.tsx

import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { EdgeStoreProvider } from '../lib/edgestore';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EdgeStoreProvider>
      <Component {...pageProps} />
    </EdgeStoreProvider>
  );
}
```

## Uploading Files

Use the `useEdgeStore` hook to upload files.

```tsx
'use client';

import * as React from 'react';
import { useEdgeStore } from '../lib/edgestore';

export default function Page() {
  const [file, setFile] = React.useState<File>();
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0]);
        }}
      />
      <button
        onClick={async () => {
          if (file) {
            const res = await edgestore.publicFiles.upload({
              file,
              onProgressChange: (progress) => {
                // you can use this to show a progress bar
                console.log(progress);
              },
            });

            // you can run some server action or api here
            // to add the necessary data to your database
            console.log(res);

            const res: {
              url: string;
              size: number;
              uploadedAt: Date;
              metadata: Record<string, never>;
              path: Record<string, never>;
              pathOrder: string;
            }
          }
        }}
      >
        Upload
      </button>
    </div>
  );
}
```