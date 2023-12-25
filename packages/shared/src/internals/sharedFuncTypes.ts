import { type Simplify } from '../types';
import { type AnyMetadata } from './bucketBuilder';
import {
  type DeleteFileRes,
  type RequestUploadPartsRes,
  type RequestUploadRes,
} from './providerTypes';

export type SharedInitRes = {
  newCookies: string[];
  token: string | undefined;
  baseUrl: string;
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
export type SharedDeleteFileRes = DeleteFileRes;
