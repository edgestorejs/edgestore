import { type Simplify } from '../types';
import { type AnyMetadata } from './bucketBuilder';
import {
  type RequestUploadPartsRes,
  type RequestUploadRes,
} from './providerTypes';

export type SharedInitRes = {
  newCookies: string[];
  token: string | undefined;
  baseUrl: string;
  providerName: string;
  requiresFileAccessCookie: boolean;
};
export type SharedRequestUploadRes = Simplify<
  RequestUploadRes & {
    size: number;
    uploadedAt: string;
    path: Record<string, string>;
    pathOrder: string[];
    metadata: AnyMetadata;
  }
>;
export type SharedRequestUploadPartsRes = RequestUploadPartsRes;

export type SharedFileMutationRes = {
  succeeded: string[];
  failed: {
    url: string;
    error: {
      code: string;
      message: string;
    };
  }[];
};

export type SharedConfirmUploadsRes = SharedFileMutationRes;
export type SharedDeleteFilesRes = SharedFileMutationRes;
