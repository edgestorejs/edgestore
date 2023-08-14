```tsx twoslash
// @noErrors
// @filename: src/app/api/edgestore/[...edgestore]/route.ts
import { initEdgeStore } from '@edgestore/server';
import { createEdgeStoreNextHandler } from '@edgestore/server/adapters/next/app';

const es = initEdgeStore.create();

/**
 * This is the main router for the Edge Store buckets.
 */
const edgeStoreRouter = es.router({
  publicImages: es.imageBucket(),
});

const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

export { handler as GET, handler as POST };

/**
 * This type is used to create the type-safe client for the frontend.
 */
export type EdgeStoreRouter = typeof edgeStoreRouter;
// @filename: src/lib/edgestore.ts
'use client';

import { EdgeStoreRouter } from '../app/api/edgestore/[...edgestore]/route';
import { createEdgeStoreProvider } from '@edgestore/react';

const { EdgeStoreProvider, useEdgeStore } =
  createEdgeStoreProvider<EdgeStoreRouter>();

export { EdgeStoreProvider, useEdgeStore };
// @filename: src/app/page.tsx
import { useEdgeStore } from '../lib/edgestore';
import * as React from 'react';

export default function Page() {
  const [file, setFile] = React.useState<File | null>(null);
  const { edgestore } = useEdgeStore();

  return (
    <div>
      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
        }}
      />
      <button
        onClick={async () => {
          if (file) {
// ---cut---
const res = await edgestore.publicImages.upload({
  file,
  onProgressChange: (progress) => {
    // you can use this to show a progress bar
    console.log(progress);
  },
});
// you can run some server action or api here
// to add the necessary data to your database
console.log(res);
//           ^?
```