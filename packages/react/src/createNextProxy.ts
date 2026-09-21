import {
  type AnyBuilder,
  type AnyRouter,
  type InferBucketPathObject,
  type InferBucketPathOrder,
  type InferMetadataObject,
  type InferSchemaInput,
  type Prettify,
  type SharedFileMutationRes,
  type SharedRequestUploadRes,
  type UploadOptions,
} from '@edgestore/shared';
import EdgeStoreClientError from './libs/errors/EdgeStoreClientError';
import { handleError } from './libs/errors/handleError';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';

type UploadResponse<TBucket extends AnyBuilder> =
  (TBucket['_def']['type'] extends 'IMAGE'
    ? {
        url: string;
        thumbnailUrl: string | null;
        size: number;
        uploadedAt: Date;
        metadata: InferMetadataObject<TBucket>;
        path: InferBucketPathObject<TBucket>;
        pathOrder: InferBucketPathOrder<TBucket>;
      }
    : {
        url: string;
        size: number;
        uploadedAt: Date;
        metadata: InferMetadataObject<TBucket>;
        path: InferBucketPathObject<TBucket>;
        pathOrder: InferBucketPathOrder<TBucket>;
      }) & {
    key?: string;
  } & (undefined extends TBucket['_def']['autoSignedUrls']
      ? unknown
      : {
          signedUrl: string;
          expiresAt: Date;
          expiresIn: number;
          signedThumbnailUrl?: string | null;
        });

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
      params: TRouter['buckets'][K]['_def']['input'] extends undefined
        ? {
            file: File;
            signal?: AbortSignal;
            onProgressChange?: (progress: number) => void;
            options?: UploadOptions;
          }
        : {
            file: File;
            signal?: AbortSignal;
            input: InferSchemaInput<TRouter['buckets'][K]['_def']['input']>;
            onProgressChange?: (progress: number) => void;
            options?: UploadOptions;
          },
    ) => Promise<Prettify<UploadResponse<TRouter['buckets'][K]>>>;
    confirm: (params: { url: string }) => Promise<void>;
    confirmMany: (params: { urls: string[] }) => Promise<SharedFileMutationRes>;
    delete: (params: { url: string }) => Promise<void>;
    deleteMany: (params: { urls: string[] }) => Promise<SharedFileMutationRes>;
  };
};

type OnProgressChangeHandler = (progress: number) => void;

export function createNextProxy<TRouter extends AnyRouter>({
  apiPath,
  uploadingCountRef,
  maxConcurrentUploads = 5,
  disableDevProxy,
}: {
  apiPath: string;
  uploadingCountRef: React.MutableRefObject<number>;
  maxConcurrentUploads?: number;
  disableDevProxy?: boolean;
}) {
  return new Proxy<BucketFunctions<TRouter>>({} as BucketFunctions<TRouter>, {
    get(_, prop) {
      const bucketName = prop as keyof TRouter['buckets'];
      const bucketFunctions = {
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
            const fileInfo = await uploadFile(
              params,
              {
                bucketName: bucketName as string,
                apiPath,
              },
              disableDevProxy,
            );
            return fileInfo;
          } finally {
            uploadingCountRef.current--;
          }
        },
        confirm: async (params: { url: string }) => {
          const result = await mutateFiles('confirm', [params.url], {
            bucketName: bucketName as string,
            apiPath,
          });
          const failure = result.failed[0];
          if (failure) {
            throw new EdgeStoreClientError(failure.error.message);
          }
        },
        confirmMany: async (params: { urls: string[] }) =>
          await mutateFiles('confirm', params.urls, {
            bucketName: bucketName as string,
            apiPath,
          }),
        delete: async (params: { url: string }) => {
          const result = await mutateFiles('delete', [params.url], {
            bucketName: bucketName as string,
            apiPath,
          });
          const failure = result.failed[0];
          if (failure) {
            throw new EdgeStoreClientError(failure.error.message);
          }
        },
        deleteMany: async (params: { urls: string[] }) =>
          await mutateFiles('delete', params.urls, {
            bucketName: bucketName as string,
            apiPath,
          }),
      } as BucketFunctions<TRouter>[string];
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
  disableDevProxy?: boolean,
) {
  try {
    onProgressChange?.(0);
    const initialExtension = getFileNameExtension(file.name) ?? '';
    const uploadFileInfo = await getUploadFileInfo({
      file,
      extension: initialExtension,
      signal,
      transform: options?.transform,
    });
    if (signal?.aborted) {
      throw new UploadAbortedError('File upload aborted');
    }
    const extension =
      getFileNameExtension(options?.manualFileName) ?? uploadFileInfo.extension;
    const res = await fetch(`${apiPath}/request-upload`, {
      method: 'POST',
      credentials: 'include',
      signal: signal,
      body: JSON.stringify({
        bucketName,
        input,
        fileInfo: {
          extension,
          type: uploadFileInfo.file.type,
          size: uploadFileInfo.file.size,
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
        file: uploadFileInfo.file,
        apiPath,
      });
    } else if ('uploadUrl' in json) {
      // Single part upload
      // Upload the file to the signed URL and get the progress
      await uploadFileInner({
        file: uploadFileInfo.file,
        uploadUrl: json.uploadUrl,
        headers: json.uploadHeaders,
        onProgressChange,
        signal,
      });
    } else {
      throw new EdgeStoreClientError('An error occurred');
    }
    return {
      key: json.key,
      url: getUrl(
        json.accessUrl,
        apiPath,
        disableDevProxy || json.disableDevProxy,
      ),
      thumbnailUrl: json.thumbnailUrl
        ? getUrl(
            json.thumbnailUrl,
            apiPath,
            disableDevProxy || json.disableDevProxy,
          )
        : null,
      ...mapSignedUploadAccess(json),
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

async function getUploadFileInfo({
  file,
  extension,
  signal,
  transform,
}: {
  file: File;
  extension: string;
  signal?: AbortSignal;
  transform?: UploadOptions['transform'];
}): Promise<{ file: File | Blob; extension: string }> {
  if (!transform) {
    return { file, extension };
  }

  const transformed = await transform({ file, extension, signal });
  if (isFileInfo(transformed)) {
    return transformed;
  }

  return {
    file: transformed,
    extension:
      transformed instanceof File
        ? (getFileNameExtension(transformed.name) ?? extension)
        : extension,
  };
}

function isFileInfo(
  value:
    | File
    | Blob
    | {
        file: File | Blob;
        extension: string;
      },
): value is {
  file: File | Blob;
  extension: string;
} {
  return 'file' in value && 'extension' in value;
}

function getFileNameExtension(fileName?: string) {
  const extensionIndex = fileName?.lastIndexOf('.') ?? -1;
  if (
    !fileName ||
    extensionIndex < 0 ||
    extensionIndex === fileName.length - 1
  ) {
    return undefined;
  }
  return fileName.slice(extensionIndex + 1);
}

function mapSignedUploadAccess(res: SharedRequestUploadRes) {
  if (!res.accessSignedUrl) {
    return {};
  }
  return {
    signedUrl: res.accessSignedUrl,
    expiresAt: res.accessSignedUrlExpiresAt
      ? new Date(res.accessSignedUrlExpiresAt)
      : new Date(),
    expiresIn: res.accessSignedUrlExpiresIn ?? 0,
    signedThumbnailUrl: res.accessSignedThumbnailUrl ?? null,
  };
}
/**
 * Protected files need third-party cookies to work.
 * Since third party cookies don't work on localhost,
 * we need to proxy the file through the server.
 */
function getUrl(url: string, apiPath: string, disableDevProxy?: boolean) {
  const mode =
    typeof process !== 'undefined'
      ? process.env.NODE_ENV
      : // @ts-expect-error - DEV is injected by Vite
        import.meta.env?.DEV
        ? 'development'
        : 'production';
  if (
    mode === 'development' &&
    !url.includes('/_public/') &&
    !disableDevProxy
  ) {
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
  headers?: Record<string, string>;
  onProgressChange?: OnProgressChangeHandler;
  signal?: AbortSignal;
}) {
  const { file, uploadUrl, headers, onProgressChange, signal } = props;
  const promise = new Promise<string | null>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadAbortedError('File upload aborted'));
      return;
    }

    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    for (const [name, value] of Object.entries(headers ?? {})) {
      request.setRequestHeader(name, value);
    }
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
    request.addEventListener('load', () => {
      // `error` event is not fired for HTTP errors (e.g. 403).
      // So we must check the status code here.
      if (request.status >= 200 && request.status < 300) {
        // Return the ETag header (needed to complete multipart upload)
        resolve(request.getResponseHeader('ETag'));
        return;
      }
      reject(
        new EdgeStoreClientError(
          `Error uploading file (HTTP ${request.status})`,
        ),
      );
    });
    request.addEventListener('error', () => {
      reject(new Error('Error uploading file'));
    });
    request.addEventListener('abort', () => {
      reject(new UploadAbortedError('File upload aborted'));
    });

    if (signal) {
      const abort = () => request.abort();
      signal.addEventListener('abort', abort, { once: true });
      request.addEventListener(
        'loadend',
        () => signal.removeEventListener('abort', abort),
        { once: true },
      );
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
  file: File | Blob;
  signal: AbortSignal | undefined;
  apiPath: string;
}) {
  const { bucketName, multipartInfo, onProgressChange, file, signal, apiPath } =
    params;
  const { partSize, parts, uploadId, key } = multipartInfo;
  const uploadingParts: {
    partNumber: number;
    progress: number;
  }[] = [];
  const uploadPart = async (
    params: {
      part: (typeof parts)[number];
      chunk: Blob;
    },
    partSignal: AbortSignal,
  ) => {
    const { part, chunk } = params;
    const { uploadUrl } = part;
    const eTag = await uploadFileInner({
      file: chunk,
      uploadUrl,
      signal: partSignal,
      onProgressChange: (progress) => {
        const uploadingPart = uploadingParts.find(
          (p) => p.partNumber === part.partNumber,
        );
        if (uploadingPart) {
          uploadingPart.progress = (progress * chunk.size) / 100;
        } else {
          uploadingParts.push({
            partNumber: part.partNumber,
            progress: (progress * chunk.size) / 100,
          });
        }
        const totalProgress =
          Math.round(
            (uploadingParts.reduce((acc, p) => acc + p.progress, 0) /
              (file.size || 1)) *
              10000,
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

  try {
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
      signal,
      maxParallel: 5,
      maxRetries: 10, // retry 10 times per part
    });

    if (signal?.aborted) throw new UploadAbortedError('File upload aborted');
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
  } catch (error) {
    if (multipartInfo.abortSupported) {
      // Cleanup is independent of the canceled transfer signal. Bucket lifecycle
      // rules must cover disconnected browsers and failed cleanup requests.
      await fetch(`${apiPath}/abort-multipart-upload`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketName, uploadId, key }),
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function mutateFiles(
  operation: 'confirm' | 'delete',
  urls: string[],
  {
    apiPath,
    bucketName,
  }: {
    apiPath: string;
    bucketName: string;
  },
) {
  const path = operation === 'confirm' ? 'confirm-uploads' : 'delete-files';
  const res = await fetch(`${apiPath}/${path}`, {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({
      urls,
      bucketName,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    await handleError(res);
  }
  return (await res.json()) as SharedFileMutationRes;
}

async function queuedPromises<TType, TRes>({
  items,
  fn,
  maxParallel,
  maxRetries = 0,
  signal,
}: {
  items: TType[];
  fn: (item: TType, signal: AbortSignal) => Promise<TRes>;
  maxParallel: number;
  maxRetries?: number;
  signal?: AbortSignal;
}): Promise<TRes[]> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const results: TRes[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      for (let attempt = 0; ; attempt++) {
        if (controller.signal.aborted)
          throw new UploadAbortedError('File upload aborted');
        try {
          results[index] = await fn(items[index]!, controller.signal);
          break;
        } catch (error) {
          if (
            controller.signal.aborted ||
            error instanceof UploadAbortedError ||
            attempt >= maxRetries
          )
            throw error;
          await new Promise<void>((resolve) => {
            const finish = () => {
              clearTimeout(timer);
              controller.signal.removeEventListener('abort', finish);
              resolve();
            };
            const timer = setTimeout(finish, 5000);
            controller.signal.addEventListener('abort', finish, { once: true });
            if (controller.signal.aborted) finish();
          });
        }
      }
    }
  };
  const workers = Array.from(
    { length: Math.min(maxParallel, items.length) },
    worker,
  );
  try {
    await Promise.all(workers);
    return results;
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    throw error;
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}
