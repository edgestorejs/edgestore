import {
  AnyRouter,
  InferBucketPathKeys,
  InferMetadataObject,
} from '@edgestore/server/core';
import { z } from 'zod';
import EdgeStoreError from './libs/errors/EdgeStoreError';

export type BucketFunctions<TRouter extends AnyRouter> = {
  [K in keyof TRouter['buckets']]: {
    upload: (
      params: z.infer<TRouter['buckets'][K]['_def']['input']> extends object
        ? {
            file: File;
            input: z.infer<TRouter['buckets'][K]['_def']['input']>;
            onProgressChange?: OnProgressChangeHandler;
            options?: UploadOptions;
          }
        : {
            file: File;
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
            path: InferBucketPathKeys<TRouter['buckets'][K]> extends never
              ? Record<string, never>
              : {
                  [TKey in InferBucketPathKeys<TRouter['buckets'][K]>]: string;
                };
          }
        : {
            url: string;
            size: number;
            uploadedAt: Date;
            metadata: InferMetadataObject<TRouter['buckets'][K]>;
            path: InferBucketPathKeys<TRouter['buckets'][K]> extends never
              ? Record<string, never>
              : {
                  [TKey in InferBucketPathKeys<TRouter['buckets'][K]>]: string;
                };
          }
    >;
    delete: (params: { url: string }) => Promise<{
      success: boolean;
    }>;
  };
};

type OnProgressChangeHandler = (progress: number) => void;

type UploadOptions = {
  replaceTargetUrl?: string;
};

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
            while (
              uploadingCountRef.current >= maxConcurrentUploads &&
              uploadingCountRef.current > 0
            ) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }
            uploadingCountRef.current++;
            return await uploadFile(params, {
              bucketName: bucketName as string,
              apiPath,
            });
          } finally {
            uploadingCountRef.current--;
          }
        },
        delete: async (params: { url: string }) => {
          return await deleteFile(params, {
            bucketName: bucketName as string,
            apiPath,
          });
        },
      };
      return bucketFunctions;
    },
  });
}

async function uploadFile(
  {
    file,
    input,
    onProgressChange,
    options,
  }: {
    file: File;
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
      body: JSON.stringify({
        bucketName,
        input,
        fileInfo: {
          extension: file.name.split('.').pop(),
          type: file.type,
          size: file.size,
          replaceTargetUrl: options?.replaceTargetUrl,
        },
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const json = await res.json();
    if (!json.uploadUrl) {
      throw new EdgeStoreError('An error occurred');
    }
    // Upload the file to the signed URL and get the progress
    await uploadFileInner(file, json.uploadUrl, onProgressChange);
    return {
      url: json.accessUrl,
      thumbnailUrl: json.thumbnailUrl,
      size: json.size,
      uploadedAt: new Date(json.uploadedAt),
      path: json.path,
      metadata: json.metadata,
    };
  } catch (e) {
    onProgressChange?.(0);
    throw e;
  }
}

const uploadFileInner = async (
  file: File,
  uploadUrl: string,
  onProgressChange?: OnProgressChangeHandler,
) => {
  const promise = new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
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
      reject(new Error('File upload aborted'));
    });
    request.addEventListener('loadend', () => {
      resolve();
    });

    request.send(file);
  });
  return promise;
};

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
    body: JSON.stringify({
      url,
      bucketName,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new EdgeStoreError('An error occurred');
  }
  return { success: true };
}
