import { AnyBuilder, EdgeStoreRouter } from '../core/internals/bucketBuilder';
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
    metadata?: {
      [key: string]: string;
    };
    replaceTargetUrl?: string;
  };
};

export type RequestUploadRes = {
  uploadUrl: string;
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
  deleteFile: (params: DeleteFileParams) => MaybePromise<DeleteFileRes>;
};
