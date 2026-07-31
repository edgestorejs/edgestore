import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type MaybePromise } from '../types';
import {
  type AnyContext,
  type AnyMetadata,
  type EdgeStoreRouter,
} from './bucketBuilder';

export type InitParams<TCtx extends AnyContext = AnyContext> = {
  ctx: TCtx;
  router: EdgeStoreRouter<TCtx>;
};

export type ClientInit = {
  path: string;
  headers?: Record<string, string>;
};

export type InitRes = {
  token?: string;
  clientInit?: ClientInit;
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

export type BackendFile = {
  url: string;
  sizeBytes: number;
  path: Record<string, string>;
  metadata: Record<string, string>;
  uploadedAt: Date | string;
  updatedAt: Date | string;
};

export type ProviderFileMutationResult<
  TErrorCode extends string =
    | 'FILE_NOT_CONFIRMABLE'
    | 'FILE_NOT_DELETABLE'
    | 'FILE_NOT_RESTORABLE'
    | 'INVALID_FILE_REF',
> = {
  results: (
    | { success: true }
    | {
        success: false;
        error: {
          code: TErrorCode;
          message: string;
        };
      }
  )[];
};

export type BackendUploadParams = {
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

export type BackendUploadResult<TFile extends BackendFile = ProviderFile> = {
  file: TFile;
  signedReadUrl?: {
    signedUrl: string;
    signedThumbnailUrl?: string | null;
    expiresAt: Date | string;
    expiresIn: number;
  };
};

export type BackendUploadOperation<TFile extends BackendFile = ProviderFile> = (
  params: BackendUploadParams,
) => MaybePromise<BackendUploadResult<TFile>>;

export type BackendGetFileOperation<
  TFile extends BackendFile = ProviderFile,
  TFileReference = FileReference,
> = (params: {
  bucketName: string;
  file: TFileReference;
}) => MaybePromise<TFile>;

export type BackendListFilesResult<
  TFile extends BackendFile = ProviderFile,
  TCursor = string,
> = {
  items: TFile[];
  limit: number;
  nextCursor: TCursor | null;
  hasMore: boolean;
};

export type BackendListFilesOperation<
  TFile extends BackendFile = ProviderFile,
  TCursor = string,
> = (params: {
  bucketName: string;
  filter?: ListFilesFilter;
  cursor?: TCursor;
  limit?: number;
}) => MaybePromise<BackendListFilesResult<TFile, TCursor>>;

export type BackendFileMutationOperation<
  TFileReference = FileReference,
  TErrorCode extends string =
    | 'FILE_NOT_CONFIRMABLE'
    | 'FILE_NOT_DELETABLE'
    | 'FILE_NOT_RESTORABLE'
    | 'INVALID_FILE_REF',
> = (params: {
  bucketName: string;
  files: TFileReference[];
}) => MaybePromise<ProviderFileMutationResult<TErrorCode>>;

export type BackendGetSignedUrlsOperation<
  TFileReference = FileReference,
  TResult extends GetSignedUrlRes = GetSignedUrlRes,
> = (params: {
  bucketName: string;
  files: TFileReference[];
  expiresIn?: number;
  includeThumbnails?: boolean;
}) => MaybePromise<TResult[]>;

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

type RequestUploadAccess = {
  accessUrl: string;
  thumbnailUrl?: string | null;
  accessSignedUrl?: string;
  accessSignedThumbnailUrl?: string | null;
  accessSignedUrlExpiresAt?: Date | string;
  accessSignedUrlExpiresIn?: number;
};

export type SinglePartRequestUploadRes = RequestUploadAccess & {
  uploadUrl: string;
};

export type MultipartRequestUploadRes = RequestUploadAccess & {
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
};

export type RequestUploadRes =
  SinglePartRequestUploadRes | MultipartRequestUploadRes;

export type GetSignedUrlRes = {
  url: string;
  signedUrl: string;
  expiresAt: Date;
  expiresIn: number;
  thumbnailUrl?: string | null;
  signedThumbnailUrl?: string | null;
};

export type ProviderReferenceDefinition<
  TSchema extends StandardSchemaV1 = StandardSchemaV1,
> = {
  schema: TSchema;
  fromUrl: (url: string) => MaybePromise<unknown>;
};

type ProviderUploadBase<
  TUpload extends BackendUploadOperation<BackendFile> | undefined =
    BackendUploadOperation<BackendFile> | undefined,
> = {
  upload?: TUpload;
};

export type ProviderMultipartUploads = {
  requestParts: (
    params: RequestUploadPartsParams,
  ) => MaybePromise<RequestUploadPartsRes>;
  complete: (params: CompleteMultipartUploadParams) => MaybePromise<void>;
};

export type ProviderUploads<
  TUpload extends BackendUploadOperation<BackendFile> | undefined =
    BackendUploadOperation<BackendFile> | undefined,
> =
  | (ProviderUploadBase<TUpload> & {
      request: (
        params: RequestUploadParams,
      ) => MaybePromise<SinglePartRequestUploadRes>;
      multipart?: never;
    })
  | (ProviderUploadBase<TUpload> & {
      request: (params: RequestUploadParams) => MaybePromise<RequestUploadRes>;
      multipart: ProviderMultipartUploads;
    });

export type ProviderFiles<
  TFileReference = FileReference,
  TCursor = string,
  TGet extends BackendGetFileOperation<BackendFile, TFileReference> =
    BackendGetFileOperation<BackendFile, TFileReference>,
  TList extends BackendListFilesOperation<BackendFile, TCursor> | undefined =
    BackendListFilesOperation<BackendFile, TCursor> | undefined,
  TConfirm extends
    BackendFileMutationOperation<TFileReference, string> | undefined =
    BackendFileMutationOperation<TFileReference, string> | undefined,
  TDelete extends
    BackendFileMutationOperation<TFileReference, string> | undefined =
    BackendFileMutationOperation<TFileReference, string> | undefined,
  TRestore extends
    BackendFileMutationOperation<TFileReference, string> | undefined =
    BackendFileMutationOperation<TFileReference, string> | undefined,
  TGetSignedUrls extends
    BackendGetSignedUrlsOperation<TFileReference> | undefined =
    BackendGetSignedUrlsOperation<TFileReference> | undefined,
> = {
  cursorSchema?: StandardSchemaV1<unknown, TCursor>;
  get: TGet;
  list?: TList;
  confirm?: TConfirm;
  delete?: TDelete;
  restore?: TRestore;
  getSignedUrls?: TGetSignedUrls;
};

export type EdgeStoreProvider<
  TReferenceSchema extends StandardSchemaV1 = StandardSchemaV1<
    unknown,
    FileReference
  >,
  TCursor = string,
  TUploads extends ProviderUploads = ProviderUploads,
  TFiles extends ProviderFiles<
    StandardSchemaV1.InferOutput<TReferenceSchema>,
    TCursor
  > = ProviderFiles<StandardSchemaV1.InferOutput<TReferenceSchema>, TCursor>,
> = {
  name: string;
  baseUrl: string | (() => MaybePromise<string>);
  init: <TCtx extends AnyContext>(
    params: InitParams<TCtx>,
  ) => MaybePromise<InitRes>;
  reference: ProviderReferenceDefinition<TReferenceSchema>;
  uploads: TUploads;
  files: TFiles;
};

export type AnyEdgeStoreProvider = EdgeStoreProvider<
  StandardSchemaV1<any, any>,
  any,
  ProviderUploads,
  ProviderFiles<any, any>
>;

declare const routerFileFieldsProviderBrand: unique symbol;

/**
 * @internal Marks providers whose read contract persists the router-derived
 * path and metadata fields.
 */
export type RouterFileFieldsProvider = {
  readonly [routerFileFieldsProviderBrand]: true;
};

export type DefaultEdgeStoreProvider = EdgeStoreProvider<
  StandardSchemaV1<unknown, FileReference>,
  string
> &
  RouterFileFieldsProvider & {
    uploads: ProviderUploads<BackendUploadOperation> & {
      upload: BackendUploadOperation;
    };
    files: ProviderFiles<FileReference, string> & {
      get: BackendGetFileOperation;
      list: BackendListFilesOperation;
      confirm: BackendFileMutationOperation;
      delete: BackendFileMutationOperation;
      restore: BackendFileMutationOperation;
      getSignedUrls: BackendGetSignedUrlsOperation;
    };
  };
