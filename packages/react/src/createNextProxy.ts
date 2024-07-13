import {
  type AnyRouter,
  type InferBucketPathObject,
  type InferMetadataObject,
  type SharedRequestUploadRes,
  type UploadOptions,
} from '@edgestore/shared';
import { type z } from 'zod';
import EdgeStoreClientError from './libs/errors/EdgeStoreClientError';
import { handleError } from './libs/errors/handleError';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';

/**
 * @internal
 * @see https://www.totaltypescript.com/concepts/the-prettify-helper
 */
export type Prettify<TType> = {
  [K in keyof TType]: TType[K];
  // eslint-disable-next-line @typescript-eslint/ban-types
} & {};

export type BucketFunctions<TRouter extends AnyRouter> = {
  [K in keyof TRouter['buckets']]: {
    /**
     * Upload a file to the bucket
     *
     * @example
     * await edgestore.myBucket.upload({
     *  file: file,
     *  signal: abortController.signal, // if you want to be able to cancel the ongoing upload
     *  onProgressChange: (progress) => { console.log(progress) }, // if you want to show the progress of the upload
     *  input: {...} // if the bucket has an input schema
     *  options: {
     *   manualFileName: file.name, // if you want to use a custom file name
     *   replaceTargetUrl: url, // if you want to replace an existing file
     *   temporary: true, // if you want to delete the file after 24 hours
     *  }
     * })
     */
    upload: (
      params: z.infer<TRouter['buckets'][K]['_def']['input']> extends never
        ? {
            file: File;
            signal?: AbortSignal;
            onProgressChange?: OnProgressChangeHandler;
            options?: UploadOptions;
          }
        : {
            file: File;
            signal?: AbortSignal;
            input: z.infer<TRouter['buckets'][K]['_def']['input']>;
            onProgressChange?: OnProgressChangeHandler;
            options?: UploadOptions;
          },
    ) => Promise<
      TRouter['buckets'][K]['_def']['type'] extends 'IMAGE'
        ? {
            url: string;
            thumbnailUrl: string | null;
            size: number;
            uploadedAt: Date;
            metadata: InferMetadataObject<TRouter['buckets'][K]>;
            path: InferBucketPathObject<TRouter['buckets'][K]>;
            pathOrder: Prettify<
              keyof InferBucketPathObject<TRouter['buckets'][K]>
            >[];
          }
        : {
            url: string;
            size: number;
            uploadedAt: Date;
            metadata: InferMetadataObject<TRouter['buckets'][K]>;
            path: InferBucketPathObject<TRouter['buckets'][K]>;
            pathOrder: Prettify<
              keyof InferBucketPathObject<TRouter['buckets'][K]>
            >[];
          }
    >;
    confirmUpload: (params: { url: string }) => Promise<void>;
    delete: (params: { url: string }) => Promise<void>;
  };
};

type OnProgressChangeHandler = (progress: number) => void;

export function createNextProxy<TRouter extends AnyRouter>({
  apiPath,
  uploadingCountRef,
  maxConcurrentUploads = 5,
}: {
  apiPath: string;
  uploadingCountRef: React.MutableRefObject<number>;
  maxConcurrentUploads?: number;
}) {
  return new Proxy<BucketFunctions<TRouter>>({} as BucketFunctions<TRouter>, {
    get(_, prop) {
      const bucketName = prop as keyof TRouter['buckets'];
      const bucketFunctions: BucketFunctions<TRouter>[string] = {
        upload: async (params) => {
          try {
            params.onProgressChange?.(0);

            // This handles the case where the user cancels the upload while it's waiting in the queue
            const abortPromise = new Promise<void>((resolve) => {
              params.signal?.addEventListener(
                'abort',
                () => {
                  resolve();
                },
                { once: true },
              );
            });

            while (
              uploadingCountRef.current >= maxConcurrentUploads &&
              uploadingCountRef.current > 0
            ) {
              await Promise.race([
                new Promise((resolve) => setTimeout(resolve, 300)),
                abortPromise,
              ]);
              if (params.signal?.aborted) {
                throw new UploadAbortedError('File upload aborted');
              }
            }

            uploadingCountRef.current++;
            const fileInfo = await uploadFile(params, {
              bucketName: bucketName as string,
              apiPath,
            });
            return fileInfo;
          } finally {
            uploadingCountRef.current--;
          }
        },
        confirmUpload: async (params: { url: string }) => {
          const { success } = await confirmUpload(params, {
            bucketName: bucketName as string,
            apiPath,
          });
          if (!success) {
            throw new EdgeStoreClientError('Failed to confirm upload');
          }
        },
        delete: async (params: { url: string }) => {
          const { success } = await deleteFile(params, {
            bucketName: bucketName as string,
            apiPath,
          });
          if (!success) {
            throw new EdgeStoreClientError('Failed to delete file');
          }
        },
      };
      return bucketFunctions;
    },
  });
}

async function uploadFile(
  {
    file,
    signal,
    input,
    onProgressChange,
    options,
  }: {
    file: File;
    signal?: AbortSignal;
    input?: object;
    onProgressChange?: OnProgressChangeHandler;
    options?: UploadOptions;
  },
  {
    apiPath,
    bucketName,
  }: {
    apiPath: string;
    bucketName: string;
  },
) {
  try {
    onProgressChange?.(0);
    const res = await fetch(`${apiPath}/request-upload`, {
      method: 'POST',
      credentials: 'include',
      signal: signal,
      body: JSON.stringify({
        bucketName,
        input,
        fileInfo: {
          extension: file.name.split('.').pop(),
          type: file.type,
          size: file.size,
          fileName: options?.manualFileName,
          replaceTargetUrl: options?.replaceTargetUrl,
          temporary: options?.temporary,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      await handleError(res);
    }
    const json = (await res.json()) as SharedRequestUploadRes;
    if ('multipart' in json) {
      await multipartUpload({
        bucketName,
        multipartInfo: json.multipart,
        onProgressChange,
        signal,
        file,
        apiPath,
      });
    } else if ('uploadUrl' in json) {
      // Single part upload
      // Upload the file to the signed URL and get the progress
      await uploadFileInner({
        file,
        uploadUrl: json.uploadUrl,
        onProgressChange,
        signal,
      });
    } else {
      throw new EdgeStoreClientError('An error occurred');
    }
    return {
      url: getUrl(json.accessUrl, apiPath),
      thumbnailUrl: json.thumbnailUrl
        ? getUrl(json.thumbnailUrl, apiPath)
        : null,
      size: json.size,
      uploadedAt: new Date(json.uploadedAt),
      path: json.path as any,
      pathOrder: json.pathOrder as any,
      metadata: json.metadata as any,
    };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new UploadAbortedError('File upload aborted');
    }
    onProgressChange?.(0);
    throw e;
  }
}

/**
 * Protected files need third-party cookies to work.
 * Since third party cookies doesn't work on localhost,
 * we need to proxy the file through the server.
 */
function getUrl(url: string, apiPath: string) {
  const mode =
    typeof process !== 'undefined'
      ? process.env.NODE_ENV
      : // @ts-expect-error - DEV is injected by Vite
      import.meta.env?.DEV
      ? 'development'
      : 'production';
  if (mode === 'development' && !url.includes('/_public/')) {
    const proxyUrl = new URL(window.location.origin);
    proxyUrl.pathname = `${apiPath}/proxy-file`;
    proxyUrl.search = new URLSearchParams({
      url,
    }).toString();
    return proxyUrl.toString();
  }
  return url;
}

async function uploadFileInner(props: {
  file: File | Blob;
  uploadUrl: string;
  onProgressChange?: OnProgressChangeHandler;
  signal?: AbortSignal;
}) {
  const { file, uploadUrl, onProgressChange, signal } = props;
  const promise = new Promise<string | null>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError('File upload aborted'));
      return;
    }

    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    // This is for Azure provider. Specifies the blob type
    request.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    request.addEventListener('loadstart', () => {
      onProgressChange?.(0);
    });
    request.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        // 2 decimal progress
        const progress = Math.round((e.loaded / e.total) * 10000) / 100;
        onProgressChange?.(progress);
      }
    });
    request.addEventListener('error', () => {
      reject(new Error('Error uploading file'));
    });
    request.addEventListener('abort', () => {
      reject(new UploadAbortedError('File upload aborted'));
    });
    request.addEventListener('loadend', () => {
      // Return the ETag header (needed to complete multipart upload)
      resolve(request.getResponseHeader('ETag'));
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        request.abort();
      });
    }

    request.send(file);
  });
  return promise;
}

async function multipartUpload(params: {
  bucketName: string;
  multipartInfo: Extract<
    SharedRequestUploadRes,
    { multipart: any }
  >['multipart'];
  onProgressChange: OnProgressChangeHandler | undefined;
  file: File;
  signal: AbortSignal | undefined;
  apiPath: string;
}) {
  const { bucketName, multipartInfo, onProgressChange, file, signal, apiPath } =
    params;
  const { partSize, parts, totalParts, uploadId, key } = multipartInfo;
  const uploadingParts: {
    partNumber: number;
    progress: number;
  }[] = [];
  const uploadPart = async (params: {
    part: typeof parts[number];
    chunk: Blob;
  }) => {
    const { part, chunk } = params;
    const { uploadUrl } = part;
    const eTag = await uploadFileInner({
      file: chunk,
      uploadUrl,
      signal,
      onProgressChange: (progress) => {
        const uploadingPart = uploadingParts.find(
          (p) => p.partNumber === part.partNumber,
        );
        if (uploadingPart) {
          uploadingPart.progress = progress;
        } else {
          uploadingParts.push({
            partNumber: part.partNumber,
            progress,
          });
        }
        const totalProgress =
          Math.round(
            uploadingParts.reduce((acc, p) => acc + p.progress * 100, 0) /
              totalParts,
          ) / 100;
        onProgressChange?.(totalProgress);
      },
    });
    if (!eTag) {
      throw new EdgeStoreClientError(
        'Could not get ETag from multipart response',
      );
    }
    return {
      partNumber: part.partNumber,
      eTag,
    };
  };

  // Upload the parts in parallel
  const completedParts = await queuedPromises({
    items: parts.map((part) => ({
      part,
      chunk: file.slice(
        (part.partNumber - 1) * partSize,
        part.partNumber * partSize,
      ),
    })),
    fn: uploadPart,
    maxParallel: 5,
    maxRetries: 10, // retry 10 times per part
  });

  // Complete multipart upload
  const res = await fetch(`${apiPath}/complete-multipart-upload`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      bucketName,
      uploadId,
      key,
      parts: completedParts,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    await handleError(res);
  }
}

async function confirmUpload(
  {
    url,
  }: {
    url: string;
  },
  {
    apiPath,
    bucketName,
  }: {
    apiPath: string;
    bucketName: string;
  },
) {
  const res = await fetch(`${apiPath}/confirm-upload`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      url,
      bucketName,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    await handleError(res);
  }
  return res.json();
}

async function deleteFile(
  {
    url,
  }: {
    url: string;
  },
  {
    apiPath,
    bucketName,
  }: {
    apiPath: string;
    bucketName: string;
  },
) {
  const res = await fetch(`${apiPath}/delete-file`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      url,
      bucketName,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    await handleError(res);
  }
  return res.json();
}

async function queuedPromises<TType, TRes>({
  items,
  fn,
  maxParallel,
  maxRetries = 0,
}: {
  items: TType[];
  fn: (item: TType) => Promise<TRes>;
  maxParallel: number;
  maxRetries?: number;
}): Promise<TRes[]> {
  const results: TRes[] = new Array(items.length);

  const executeWithRetry = async (
    func: () => Promise<TRes>,
    retries: number,
  ): Promise<TRes> => {
    try {
      return await func();
    } catch (error) {
      if (error instanceof UploadAbortedError) {
        throw error;
      }
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return executeWithRetry(func, retries - 1);
      } else {
        throw error;
      }
    }
  };

  const semaphore = {
    count: maxParallel,
    async wait() {
      // If we've reached our maximum concurrency or it's the last item, wait
      while (this.count <= 0)
        await new Promise((resolve) => setTimeout(resolve, 500));
      this.count--;
    },
    signal() {
      this.count++;
    },
  };

  const tasks: Promise<void>[] = items.map((item, i) =>
    (async () => {
      await semaphore.wait();

      try {
        const result = await executeWithRetry(() => fn(item), maxRetries);
        results[i] = result;
      } finally {
        semaphore.signal();
      }
    })(),
  );

  await Promise.all(tasks);
  return results;
}
