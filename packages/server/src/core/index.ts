import { EdgeStoreRouter } from './internals/bucketBuilder';

export * from './client';
export * from './sdk';
export type {
  InferBucketPathKeys,
  InferMetadataObject,
} from './internals/bucketBuilder';

export type AnyRouter = EdgeStoreRouter<any>;
