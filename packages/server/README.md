# Docs

Check the official [documentation](https://edgestore.dev) for more information.

# Quick Start

## Next.js Setup

### Install

Let's start by installing the required packages.

```shell
npm install @edgestore/server @edgestore/react zod
```

### Environment Variables

Then go to your [Dashboard](https://dashboard.edgestore.dev), create a new project and copy the keys to your environment variables.

```shell title=".env"
EDGE_STORE_ACCESS_KEY=your-access-key
EDGE_STORE_SECRET_KEY=your-secret-key
```

### Backend

Now we can create the backend code for our Next.js app.<br/>
Edge Store is compatible with both types of Next.js apps (`pages router` and `app router`).

The example below is the simplest bucket you can create with Edge Store. Just a simple file bucket with no validation that will be accessible by anyone with the link.

You can have multiple buckets in your app, each with its own configuration.

```ts title="src/app/api/edgestore/[...edgestore]/route.ts"
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

### Frontend

Now let's initiate our context provider.

```tsx title="src/lib/edgestore.ts"
'use client';

import { createEdgeStoreProvider } from '@edgestore/react';
import { type EdgeStoreRouter } from '../app/api/edgestore/[...edgestore]/route';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
```

And then wrap our app with the provider.

```tsx title="src/app/layout.tsx"
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

### Upload file

You can use the `useEdgeStore` hook to access typesafe frontend client and use it to upload files.

```tsx {1, 6, 19-28}
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
          }
        }}
      >
        Upload
      </button>
    </div>
  );
}
```

### Replace file

By passing the `replaceTargetUrl` option, you can replace an existing file with a new one.
It will automatically delete the old file after the upload is complete.

You can also just upload the file using the same file name, but in that case, you might still see the old file for a while because of the CDN cache.

```tsx
const res = await edgestore.publicFiles.upload({
  file,
  options: {
    replaceTargetUrl: oldFileUrl,
  },
  // ...
});
```

### Delete file

```tsx
await edgestore.publicFiles.delete({
  url: urlToDelete,
});
```
