import { type EdgeStoreRouter } from './internals/bucketBuilder';

export * from './client';
export * from './sdk';
export type {
  InferBucketPathKeys,
  InferBucketPathObject,
  InferMetadataObject,
} from './internals/bucketBuilder';
export type {
  EdgeStoreErrorCodeKey,
  EdgeStoreErrorDetails,
  EdgeStoreJsonResponse,
} from '../libs/errors/EdgeStoreError';
export { EdgeStoreApiClientError } from '../libs/errors/EdgeStoreApiClientError';

export type AnyRouter = EdgeStoreRouter<any>;
