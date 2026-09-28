import { type Simplify } from '../types';
import { type AnyMetadata } from './bucketBuilder';
import {
  type ClientInit,
  type RequestUploadPartsRes,
  type RequestUploadRes,
  type SignedReadUrl,
} from './providerTypes';

export type SharedInitRes = {
  newCookies: string[];
  clientInit?: ClientInit;
};
export type SharedRequestUploadRes = Simplify<
  RequestUploadRes & {
    size: number;
    path: Record<string, string>;
    pathOrder: string[];
    metadata: AnyMetadata;
    /**
     * Authorizes `/upload-status` for this upload. Returned when the provider
     * reports processing state.
     */
    statusToken?: string;
  }
>;
export type SharedRequestUploadPartsRes = RequestUploadPartsRes;
export type SharedUploadStatusRes =
  | { status: 'processing' | 'canceled' }
  | {
      status: 'completed';
      file: {
        url: string;
        key?: string;
        thumbnailUrl: string | null;
        size: number;
      };
      /** Re-signed after processing, for buckets with `autoSignedUrls`. */
      signedReadUrl?: SignedReadUrl;
    };

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
