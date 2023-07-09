import { MaybePromise } from "../types";
import {
  AnyBuilder,
  AnyEdgeStoreRouter,
} from "../core/internals/bucketBuilder";

export type InitParams = {
  ctx: any;
  router: AnyEdgeStoreRouter<any>;
};

export type RequestUploadBody = {
  route: AnyBuilder;
  fileInfo: {
    routeName: string;
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
  };
};

type InitRes = {
  token?: string;
};

export type Provider = {
  init: (params: InitParams) => MaybePromise<InitRes>;
  getBaseUrl: () => MaybePromise<string>;
  requestUpload: (params: RequestUploadBody) => MaybePromise<{
    uploadUrl: string;
    accessUrl: string;
  }>;
};
