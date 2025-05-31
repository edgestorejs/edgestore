---
id: error-handling
title: Error Handling
sidebar_label: Error Handling
slug: /error-handling
---

# Error Handling

You might need to handle specific server errors in your application. Here is an example of how you can do that.

```tsx
import {
  EdgeStoreApiClientError,
  UploadAbortedError,
} from '@edgestore/react/errors';

// ...

<button
  onClick={async () => {
    try {
      if (file) {
        const res = await edgestore.publicFiles.upload({
          file,
        });
      }
    } catch (error) {
      // All errors are typed and you will get intellisense for them
      if (error instanceof EdgeStoreApiClientError) {
        // if it fails due to the `maxSize` set in the router config
        if (error.data.code === 'FILE_TOO_LARGE') {
          alert(
            `File too large. Max size is ${formatFileSize(
              error.data.details.maxFileSize,
            )}`,
          );
        }
        // if it fails due to the `accept` set in the router config
        if (error.data.code === 'MIME_TYPE_NOT_ALLOWED') {
          alert(
            `File type not allowed. Allowed types are ${error.data.details.allowedMimeTypes.join(
              ', ',
            )}`,
          );
        }
        // if it fails during the `beforeUpload` check
        if (error.data.code === 'UPLOAD_NOT_ALLOWED') {
          alert("You don't have permission to upload files here.");
        }
      } else if (error instanceof UploadAbortedError) {
        // if the upload was canceled from an AbortController's signal
        console.log('Upload aborted');
      } else {
        // unknown error
        console.error(error);
      }
    }
  }}
  disabled={!file || !!uploadedUrl}
>
  Upload
</button>
```

## Error Codes

- `BAD_REQUEST`
- `FILE_TOO_LARGE`
- `MIME_TYPE_NOT_ALLOWED`
- `UNAUTHORIZED`
- `UPLOAD_NOT_ALLOWED`
- `DELETE_NOT_ALLOWED`
- `CREATE_CONTEXT_ERROR`
- `SERVER_ERROR`