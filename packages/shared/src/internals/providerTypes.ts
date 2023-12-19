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
  init: (params: InitParams) => MaybePromise<InitRes>;
  getBaseUrl: () => MaybePromise<string>;
  getFile: (params: GetFileParams) => MaybePromise<GetFileRes>;
  requestUpload: (
    params: RequestUploadParams,
  ) => MaybePromise<RequestUploadRes>;
  requestUploadParts: (
    params: RequestUploadPartsParams,
  ) => MaybePromise<RequestUploadPartsRes>;
  completeMultipartUpload: (
    params: CompleteMultipartUploadParams,
  ) => MaybePromise<CompleteMultipartUploadRes>;
  confirmUpload: (params: ConfirmUpload) => MaybePromise<ConfirmUploadRes>;
  deleteFile: (params: DeleteFileParams) => MaybePromise<DeleteFileRes>;
};
