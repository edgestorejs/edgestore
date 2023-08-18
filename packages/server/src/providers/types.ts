import {
  AnyBuilder,
  AnyMetadata,
  EdgeStoreRouter,
} from '../core/internals/bucketBuilder';
import { MaybePromise } from '../types';

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
    path: {
      key: string;
      value: string;
    }[];
    metadata: AnyMetadata;
    replaceTargetUrl?: string;
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

export type RequestUploadRes =
  | {
      uploadUrl: string;
      accessUrl: string;
    }
  | {
      multipart: {
        uploadId: string;
        partSize: number;
        totalParts: number;
        parts: {
          partNumber: number;
          uploadUrl: string;
        }[];
      };
      accessUrl: string;
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
  deleteFile: (params: DeleteFileParams) => MaybePromise<DeleteFileRes>;
};
