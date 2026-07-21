import { type MaybePromise } from '../types';
import {
  type AnyBuilder,
  type AnyMetadata,
  type EdgeStoreRouter,
} from './bucketBuilder';

export type InitParams = {
  ctx: any;
  router: EdgeStoreRouter<any>;
};

export type InitRes = {
  token?: string;
};

export type GetFileParams = {
  url: string;
};

export type GetFileRes = {
  url: string;
  size: number;
  uploadedAt: Date;
  path: {
    [key: string]: string;
  };
  metadata: {
    [key: string]: string;
  };
};

export type RequestUploadParams = {
  multipart?: {
    uploadId?: string;
    parts: number[];
  };
  bucketName: string;
  bucketType: string;
  fileInfo: {
    type?: string;
    size: number;
    extension: string;
    isPublic: boolean;
    fileName?: string;
    path: {
      key: string;
      value: string;
    }[];
    metadata: AnyMetadata;
    replaceTargetUrl?: string;
    temporary: boolean;
  };
  autoSignedUrls?: {
    expiresIn?: number;
    includeThumbnails?: boolean;
  };
};

export type ProviderFilterValue =
  | string
  | Partial<{
      eq: string;
      neq: string;
      gt: string;
      gte: string;
      lt: string;
      lte: string;
      startsWith: string;
      endsWith: string;
      between: [string, string];
    }>;

export type ListFilesFilter = {
  AND?: ListFilesFilter[];
  OR?: ListFilesFilter[];
  uploadedAt?: ProviderFilterValue;
  path?: Record<string, ProviderFilterValue>;
  metadata?: Record<string, ProviderFilterValue>;
};

export type ListFilesParams = {
  bucketName: string;
  filter?: ListFilesFilter;
  pagination?: {
    cursor?: string;
    limit?: number;
  };
};

export type ListFilesRes = {
  data: {
    url: string;
    thumbnailUrl?: string | null;
    size: number;
    uploadedAt: Date;
    path: Record<string, string>;
    metadata: Record<string, string>;
  }[];
  pagination: {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type FileReference = { id: string } | { key: string } | { url: string };

export type ProviderFile = {
  id: string;
  url: string;
  key: string;
  thumbnailUrl: string | null;
  thumbnailKey: string | null;
  bucketId: string;
  bucketName: string;
  projectId: string;
  accountId: string;
  name: string;
  path: Record<string, string>;
  metadata: Record<string, string>;
  sizeBytes: number;
  mimeType: string | null;
  state: 'requested' | 'uploaded' | 'deleted' | 'replace_requested';
  temporary: boolean;
  uploadedAt: Date;
  updatedAt: Date;
};

export type ProviderFileMutationResult = {
  results: (
    | { fileRef: FileReference; success: true }
    | {
        fileRef: FileReference;
        success: false;
        error: {
          code:
            | 'FILE_NOT_CONFIRMABLE'
            | 'FILE_NOT_DELETABLE'
            | 'FILE_NOT_RESTORABLE'
            | 'INVALID_FILE_REF';
          message: string;
        };
      }
  )[];
  successCount: number;
  failureCount: number;
};

export type ProviderBackendUploadParams = {
  bucketName: string;
  bucketType: string;
  fileInfo: RequestUploadParams['fileInfo'];
  autoSignedUrls?: RequestUploadParams['autoSignedUrls'];
  source: Blob;
  signal?: AbortSignal;
  onProgress?: (progress: {
    transferredBytes: number;
    totalBytes: number;
    percentage: number;
    phase: 'preparing' | 'uploading' | 'processing';
  }) => void;
};

export type ProviderBackend = {
  upload: (params: ProviderBackendUploadParams) => MaybePromise<{
    file: ProviderFile;
    signedReadUrl?: {
      signedUrl: string;
      signedThumbnailUrl?: string | null;
      expiresAt: Date;
      expiresIn: number;
    };
  }>;
  getFile: (params: { file: FileReference }) => MaybePromise<ProviderFile>;
  listFiles: (params: {
    bucketName: string;
    filter?: ListFilesFilter;
    cursor?: string;
    limit?: number;
  }) => MaybePromise<{
    items: ProviderFile[];
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  confirmFiles: (params: {
    files: FileReference[];
  }) => MaybePromise<ProviderFileMutationResult>;
  deleteFiles: (params: {
    files: FileReference[];
  }) => MaybePromise<ProviderFileMutationResult>;
  restoreFiles: (params: {
    files: FileReference[];
  }) => MaybePromise<ProviderFileMutationResult>;
};

export type RequestUploadPartsParams = {
  multipart: {
    uploadId: string;
    parts: number[];
  };
  path: string;
};

export type RequestUploadPartsRes = {
  multipart: {
    uploadId: string;
    parts: {
      partNumber: number;
      uploadUrl: string;
    }[];
  };
};

export type CompleteMultipartUploadParams = {
  uploadId: string;
  key: string;
  parts: {
    partNumber: number;
    eTag: string;
  }[];
};

export type CompleteMultipartUploadRes = {
  success: boolean;
};

export type RequestUploadRes =
  | {
      uploadUrl: string;
      accessUrl: string;
      thumbnailUrl?: string | null;
      accessSignedUrl?: string;
      accessSignedThumbnailUrl?: string | null;
      accessSignedUrlExpiresAt?: Date | string;
      accessSignedUrlExpiresIn?: number;
    }
  | {
      multipart: {
        key: string;
        uploadId: string;
        partSize: number;
        totalParts: number;
        parts: {
          partNumber: number;
          uploadUrl: string;
        }[];
      };
      accessUrl: string;
      thumbnailUrl?: string | null;
      accessSignedUrl?: string;
      accessSignedThumbnailUrl?: string | null;
      accessSignedUrlExpiresAt?: Date | string;
      accessSignedUrlExpiresIn?: number;
    };

export type GetSignedUrlsParams = {
  bucketName: string;
  urls: string[];
  expiresIn?: number;
  includeThumbnails?: boolean;
};

export type GetSignedUrlRes = {
  url: string;
  signedUrl: string;
  expiresAt: Date;
  expiresIn: number;
  thumbnailUrl?: string | null;
  signedThumbnailUrl?: string | null;
};

export type ConfirmUpload = {
  bucket: AnyBuilder;
  url: string;
};

export type ConfirmUploadRes = {
  success: boolean;
};

export type DeleteFileParams = {
  bucket: AnyBuilder;
  url: string;
};

export type DeleteFileRes = {
  success: boolean;
};

export type Provider = {
  name: string;
  init: (params: InitParams) => MaybePromise<InitRes>;
  getBaseUrl: () => MaybePromise<string>;
  getFile: (params: GetFileParams) => MaybePromise<GetFileRes>;
  requestUpload: (
    params: RequestUploadParams,
  ) => MaybePromise<RequestUploadRes>;
  requestUploadParts: (
    params: RequestUploadPartsParams,
  ) => MaybePromise<RequestUploadPartsRes>;
  getSignedUrls?: (
    params: GetSignedUrlsParams,
  ) => MaybePromise<GetSignedUrlRes[]>;
  listFiles?: (params: ListFilesParams) => MaybePromise<ListFilesRes>;
  completeMultipartUpload: (
    params: CompleteMultipartUploadParams,
  ) => MaybePromise<CompleteMultipartUploadRes>;
  confirmUpload: (params: ConfirmUpload) => MaybePromise<ConfirmUploadRes>;
  deleteFile: (params: DeleteFileParams) => MaybePromise<DeleteFileRes>;
  /** Privileged router-client operations. Providers expose this capability only when supported. */
  backend?: ProviderBackend;
};

export type BackendClientProvider = Provider & {
  backend: ProviderBackend;
};
