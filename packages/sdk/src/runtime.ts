import type { OperationBody, OperationResult } from './internal/operationTypes';
import {
  createRuntimeOperations,
  type RuntimeOperations,
} from './internal/runtimeOperations';
import type { Transport } from './internal/transport';

export type RuntimeCallOptions = { signal?: AbortSignal };

type ProjectMode = 'current' | 'explicit';
type ProjectScope<TMode extends ProjectMode> = TMode extends 'explicit'
  ? { project: string }
  : { project?: never };
type ScopedInput<TMode extends ProjectMode, TInput> = TInput &
  ProjectScope<TMode>;
type ProjectCallArgs<TMode extends ProjectMode> = TMode extends 'explicit'
  ? [input: RuntimeCallOptions & { project: string }]
  : [options?: RuntimeCallOptions];

export type RuntimeAccessTokenCreateInput =
  OperationBody<'v2.runtime.accessToken.create'> & RuntimeCallOptions;
export type RuntimeAccessTokenCreateResult =
  OperationResult<'v2.runtime.accessToken.create'>;
export type RuntimeProjectGetResult =
  OperationResult<'v2.runtime.projects.get'>;
export type RuntimeBucketListResult =
  OperationResult<'v2.runtime.buckets.list'>;
export type RuntimeBucketGetInput = { bucket: string } & RuntimeCallOptions;
export type RuntimeBucketGetResult = OperationResult<'v2.runtime.buckets.get'>;

export type RuntimeFileSearchInput = {
  bucket: string;
} & OperationBody<'v2.runtime.files.search'> &
  RuntimeCallOptions;
export type RuntimeFileSearchResult =
  OperationResult<'v2.runtime.files.search'>;
export type RuntimeFileLookupInput = OperationBody<'v2.runtime.files.lookup'> &
  RuntimeCallOptions;
export type RuntimeFileLookupResult =
  OperationResult<'v2.runtime.files.lookup'>;
export type RuntimeSignedUrlsCreateInput = {
  bucket: string;
} & OperationBody<'v2.runtime.files.signedUrls.create'> &
  RuntimeCallOptions;
export type RuntimeSignedUrlsCreateResult =
  OperationResult<'v2.runtime.files.signedUrls.create'>;
export type RuntimeFileConfirmInput =
  OperationBody<'v2.runtime.files.confirm'> & RuntimeCallOptions;
export type RuntimeFileConfirmResult =
  OperationResult<'v2.runtime.files.confirm'>;
export type RuntimeFileDeleteInput = OperationBody<'v2.runtime.files.delete'> &
  RuntimeCallOptions;
export type RuntimeFileDeleteResult =
  OperationResult<'v2.runtime.files.delete'>;
export type RuntimeFileRestoreInput =
  OperationBody<'v2.runtime.files.restore'> & RuntimeCallOptions;
export type RuntimeFileRestoreResult =
  OperationResult<'v2.runtime.files.restore'>;

export type RuntimeUploadRequestInput = {
  bucket: string;
} & OperationBody<'v2.runtime.uploads.request'> &
  RuntimeCallOptions;
export type RuntimeUploadRequestResult =
  OperationResult<'v2.runtime.uploads.request'>;
export type RuntimeUploadGetInput = { uploadId: string } & RuntimeCallOptions;
export type RuntimeUploadGetResult = OperationResult<'v2.runtime.uploads.get'>;
export type RuntimeUploadCancelInput = RuntimeUploadGetInput;
export type RuntimeUploadCancelResult =
  OperationResult<'v2.runtime.uploads.cancel'>;
export type RuntimeUploadPartsCreateInput = {
  uploadId: string;
} & OperationBody<'v2.runtime.uploads.parts.create'> &
  RuntimeCallOptions;
export type RuntimeUploadPartsCreateResult =
  OperationResult<'v2.runtime.uploads.parts.create'>;
export type RuntimeUploadCompleteInput = {
  uploadId: string;
} & OperationBody<'v2.runtime.uploads.multipart.complete'> &
  RuntimeCallOptions;
export type RuntimeUploadCompleteResult =
  OperationResult<'v2.runtime.uploads.multipart.complete'>;

export type RuntimeClient<TMode extends ProjectMode> = {
  accessTokens: {
    create(
      input: ScopedInput<TMode, RuntimeAccessTokenCreateInput>,
    ): Promise<RuntimeAccessTokenCreateResult>;
  };
  projects: {
    get(...args: ProjectCallArgs<TMode>): Promise<RuntimeProjectGetResult>;
  };
  buckets: {
    list(...args: ProjectCallArgs<TMode>): Promise<RuntimeBucketListResult>;
    get(
      input: ScopedInput<TMode, RuntimeBucketGetInput>,
    ): Promise<RuntimeBucketGetResult>;
  };
  files: {
    search(
      input: ScopedInput<TMode, RuntimeFileSearchInput>,
    ): Promise<RuntimeFileSearchResult>;
    lookup(
      input: ScopedInput<TMode, RuntimeFileLookupInput>,
    ): Promise<RuntimeFileLookupResult>;
    createSignedUrls(
      input: ScopedInput<TMode, RuntimeSignedUrlsCreateInput>,
    ): Promise<RuntimeSignedUrlsCreateResult>;
    confirm(
      input: ScopedInput<TMode, RuntimeFileConfirmInput>,
    ): Promise<RuntimeFileConfirmResult>;
    delete(
      input: ScopedInput<TMode, RuntimeFileDeleteInput>,
    ): Promise<RuntimeFileDeleteResult>;
    restore(
      input: ScopedInput<TMode, RuntimeFileRestoreInput>,
    ): Promise<RuntimeFileRestoreResult>;
  };
  uploads: {
    request(
      input: ScopedInput<TMode, RuntimeUploadRequestInput>,
    ): Promise<RuntimeUploadRequestResult>;
    get(
      input: ScopedInput<TMode, RuntimeUploadGetInput>,
    ): Promise<RuntimeUploadGetResult>;
    cancel(
      input: ScopedInput<TMode, RuntimeUploadCancelInput>,
    ): Promise<RuntimeUploadCancelResult>;
    createParts(
      input: ScopedInput<TMode, RuntimeUploadPartsCreateInput>,
    ): Promise<RuntimeUploadPartsCreateResult>;
    completeMultipart(
      input: ScopedInput<TMode, RuntimeUploadCompleteInput>,
    ): Promise<RuntimeUploadCompleteResult>;
  };
};

export type ProjectRuntimeClient = RuntimeClient<'current'>;
export type ExplicitProjectRuntimeClient = RuntimeClient<'explicit'>;

export function createExplicitProjectRuntimeClient(
  transport: Transport,
): ExplicitProjectRuntimeClient {
  return createRuntimeOperations(transport);
}

export function createProjectRuntimeClient(
  transport: Transport,
): ProjectRuntimeClient {
  return scopeRuntimeOperations(createRuntimeOperations(transport), '_current');
}

function scopeRuntimeOperations(
  operations: RuntimeOperations,
  project: string,
): ProjectRuntimeClient {
  const entries = Object.entries(operations).map(([resourceName, resource]) => [
    resourceName,
    Object.fromEntries(
      Object.entries(resource).map(([operationName, operation]) => [
        operationName,
        (input: object | undefined) =>
          operation({ ...input, project } as never),
      ]),
    ),
  ]);

  return Object.fromEntries(entries) as ProjectRuntimeClient;
}
