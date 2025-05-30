# EdgeStore Minimal Setup for TanStack Start

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

In your TanStack Start application, create an API route for EdgeStore with the following content:

```ts
app/routes/api/edgestore.$.ts

import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreStartHandler } from '@edgestore/server/adapters/start';
import { createAPIFileRoute } from '@tanstack/start/api';

const es = initEdgeStore.create();
const edgeStoreRouter = es.router({
  publicFiles: es.fileBucket(),
});

export type EdgeStoreRouter = typeof edgeStoreRouter;

const handler = createEdgeStoreStartHandler({
  router: edgeStoreRouter,
});

export const APIRoute = createAPIFileRoute('/api/edgestore/$')({
  GET: handler,
  POST: handler,
});
```

## Frontend

Initiate the context provider.

```tsx
app/utils/edgestore.ts

import { createEdgeStoreProvider } from '@edgestore/react';
import { type EdgeStoreRouter } from '../routes/api/edgestore.$';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
```

Wrap your app with the provider.

```tsx
app/routes/__root.tsx

import { EdgeStoreProvider } from '~/utils/edgestore';

// ...

function RootComponent() {
  return (
    <EdgeStoreProvider>
      <Outlet />
    </EdgeStoreProvider>
  );
}
```

## Uploading Files

Use the `useEdgeStore` hook to upload files.

```tsx
'use client';

import * as React from 'react';
import { useEdgeStore } from '../utils/edgestore';

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