# Edge Store Cheatsheet

## Buckets
- **File Bucket**: `es.fileBucket()`
- **Image Bucket**: `es.imageBucket()`
  - Auto-thumbnail generation for images >200px (included in upload response)

## File Validation
```ts
es.fileBucket({
  maxSize: 1024 * 1024 * 10, // 10MB
  accept: ['image/jpeg', 'image/png'], // or wildcard: ['image/*']
})
```

## Metadata & Path
```ts
es.fileBucket()
  .input(z.object({ category: z.string() }))
  .path(({ ctx, input }) => [{ category: input.category }, { author: ctx.userId }])
  .metadata(({ ctx }) => ({ userRole: ctx.userRole }))
```

## Lifecycle Hooks
```ts
.beforeUpload(({ ctx, input, fileInfo }) => true)
.beforeDelete(({ ctx, fileInfo }) => true)
```

## Access Control (Experimental)
```ts
.accessControl({
  OR: [
    { userId: { path: 'author' } },
    { userRole: { eq: 'admin' } },
  ],
})
```

## Client Usage
```ts
import { useEdgeStore } from '../lib/edgestore';

const { edgestore } = useEdgeStore();
```

### Upload File
```ts
await edgestore.publicFiles.upload({
  file,
  onProgressChange: (progress) => console.log(progress),
});
```

### Replace File
```ts
await edgestore.publicFiles.upload({
  file,
  options: { replaceTargetUrl: oldFileUrl },
});
```

### Delete File
```ts
await edgestore.publicFiles.delete({ url: urlToDelete });
```

### Temporary Files
```ts
await edgestore.publicFiles.upload({
  file,
  options: { temporary: true },
});

await edgestore.publicFiles.confirmUpload({ url });
```

### Cancel Upload
```ts
const controller = new AbortController();
await edgestore.publicFiles.upload({
  file,
  signal: controller.signal,
});
controller.abort();
```

## Backend Client
```ts
const backendClient = initEdgeStoreClient({ router: edgeStoreRouter });

// Upload text
await backendClient.publicFiles.upload({ content: 'text' });

// Upload blob
await backendClient.publicFiles.upload({
  content: {
    blob: new Blob(['data'], { type: 'text/csv' }),
    extension: 'csv',
  },
  options: { temporary: true },
  ctx: { userId: '123', userRole: 'admin' },
  input: { type: 'post' },
});

// Copy file
await backendClient.publicFiles.upload({
  content: { url: 'https://...', extension: 'txt' },
});

// Confirm temp upload
await backendClient.publicFiles.confirmUpload({ url });

// Delete
await backendClient.publicFiles.deleteFile({ url });

// List files
await backendClient.publicFiles.listFiles({
  filter: {
    metadata: { role: 'admin' },
    path: { type: 'post' },
    uploadedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
  },
  pagination: { currentPage: 1, pageSize: 50 },
});
```

## Utils
```ts
import { getDownloadUrl, formatFileSize } from '@edgestore/react/utils';

getDownloadUrl(url, 'filename.jpg');
formatFileSize(10485760); // => '10MB'
```

## Error Handling
```ts
import {
  EdgeStoreApiClientError,
  UploadAbortedError,
} from '@edgestore/react/errors';

try {
  await edgestore.publicFiles.upload({ file });
} catch (error) {
  if (error instanceof EdgeStoreApiClientError) {
    switch (error.data.code) {
      case 'FILE_TOO_LARGE':
      case 'MIME_TYPE_NOT_ALLOWED':
      case 'UPLOAD_NOT_ALLOWED':
        alert(error.data.message);
    }
  } else if (error instanceof UploadAbortedError) {
    console.log('Upload aborted');
  } else {
    console.error(error);
  }
}
```

### Error Codes
- `BAD_REQUEST`
- `FILE_TOO_LARGE`
- `MIME_TYPE_NOT_ALLOWED`
- `UNAUTHORIZED`
- `UPLOAD_NOT_ALLOWED`
- `DELETE_NOT_ALLOWED`
- `CREATE_CONTEXT_ERROR`
- `SERVER_ERROR`

## Log Levels
- `debug`, `info`, `warn`, `error`, `none`
```ts
createEdgeStoreNextHandler({ logLevel: 'debug', router });
```

## Provider Options
```ts
createEdgeStoreProvider({ maxConcurrentUploads: 5 });
```

## MIME Types (IMAGE bucket)
- image/jpeg, image/png, image/gif, image/webp, image/svg+xml, image/tiff, image/bmp, image/x-icon

