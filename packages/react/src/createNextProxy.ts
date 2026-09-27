import {
  type AnyBuilder,
  type AnyRouter,
  type InferBucketPathObject,
  type InferBucketPathOrder,
  type InferMetadataObject,
  type InferSchemaInput,
  type Prettify,
  type ProviderUploadOptions,
  type RouterProvider,
  type SharedFileMutationRes,
  type SharedRequestUploadRes,
  type UploadOptions,
} from '@edgestore/shared';
import EdgeStoreClientError from './libs/errors/EdgeStoreClientError';
import { handleError } from './libs/errors/handleError';
import { UploadAbortedError } from './libs/errors/uploadAbortedError';
import { putBlob } from './libs/putBlob';
import { multipartUpload } from './multipartUpload';

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
    /** Stable object key, when the provider exposes one. */
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
     *   replaceTargetUrl: url, // replace an existing file, when the provider supports it
     *   temporary: true, // delete the file unless confirmed within 24 hours, when the provider supports it
     *  }
     * })
     */
    upload: (
      params: TRouter['buckets'][K]['_def']['input'] extends undefined
        ? {
            file: File;
            signal?: AbortSignal;
            onProgressChange?: (progress: number) => void;
            options?: ProviderUploadOptions<
              UploadOptions,
              RouterProvider<TRouter>
            >;
          }
        : {
            file: File;
            signal?: AbortSignal;
            input: InferSchemaInput<TRouter['buckets'][K]['_def']['input']>;
            onProgressChange?: (progress: number) => void;
            options?: ProviderUploadOptions<
              UploadOptions,
              RouterProvider<TRouter>
            >;
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
}: {
  apiPath: string;
  uploadingCountRef: React.MutableRefObject<number>;
  maxConcurrentUploads?: number;
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
            const fileInfo = await uploadFile(params, {
              bucketName: bucketName as string,
              apiPath,
            });
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
    const blob = uploadFileInfo.file;
    if ('multipart' in json) {
      await multipartUpload({
        apiPath,
        bucketName,
        multipart: json.multipart,
        file: blob,
        signal,
        onProgressChange,
      });
    } else if ('uploadUrl' in json) {
      await putBlob({
        blob,
        url: json.uploadUrl,
        headers: json.uploadHeaders,
        signal,
        onProgress: (loadedBytes) =>
          onProgressChange?.(
            Math.round((loadedBytes / (blob.size || 1)) * 10000) / 100,
          ),
      });
    } else {
      throw new EdgeStoreClientError('An error occurred');
    }
    return {
      key: json.key,
      url: json.accessUrl,
      thumbnailUrl: json.thumbnailUrl ?? null,
      ...mapSignedUploadAccess(json),
      size: json.size,
      uploadedAt: new Date(json.uploadedAt),
      path: json.path as any,
      pathOrder: json.pathOrder as any,
      metadata: json.metadata as any,
    };
  } catch (e) {
    onProgressChange?.(0);
    if (signal?.aborted || (e instanceof Error && e.name === 'AbortError')) {
      throw new UploadAbortedError('File upload aborted');
    }
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
