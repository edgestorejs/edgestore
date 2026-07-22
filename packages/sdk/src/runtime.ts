import type { OperationBody, OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';
import { uploadRuntimeFile, uploadRuntimeFileFromUrl } from './upload';
import type {
  RuntimeUploadFromUrlInput,
  RuntimeUploadInput,
  RuntimeUploadResult,
  UploadDefaults,
} from './uploadTypes';

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
export type RuntimeFileBatchInput = OperationBody<'v2.runtime.files.confirm'> &
  RuntimeCallOptions;
export type RuntimeFileBatchResult =
  OperationResult<'v2.runtime.files.confirm'>;

export type RuntimeUploadRequestInput = {
  bucket: string;
} & OperationBody<'v2.runtime.uploads.request'> &
  RuntimeCallOptions & { idempotencyKey?: string };
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
      input: ScopedInput<TMode, RuntimeFileBatchInput>,
    ): Promise<RuntimeFileBatchResult>;
    delete(
      input: ScopedInput<TMode, RuntimeFileBatchInput>,
    ): Promise<RuntimeFileBatchResult>;
    restore(
      input: ScopedInput<TMode, RuntimeFileBatchInput>,
    ): Promise<RuntimeFileBatchResult>;
  };
  uploads: {
    upload(
      input: ScopedInput<TMode, RuntimeUploadInput>,
    ): Promise<RuntimeUploadResult>;
    uploadFromUrl(
      input: ScopedInput<TMode, RuntimeUploadFromUrlInput>,
    ): Promise<RuntimeUploadResult>;
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
  uploadDefaults?: UploadDefaults,
): ExplicitProjectRuntimeClient {
  return {
    accessTokens: {
      create: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/runtime/projects/{projectRef}/access-token', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
    },
    projects: {
      get: ({ project, signal }) =>
        transport.execute(() =>
          transport.client.GET('/runtime/projects/{projectRef}', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
    },
    buckets: {
      list: ({ project, signal }) =>
        transport.execute(() =>
          transport.client.GET('/runtime/projects/{projectRef}/buckets', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      get: ({ project, bucket, signal }) =>
        transport.execute(() =>
          transport.client.GET(
            '/runtime/projects/{projectRef}/buckets/{bucketName}',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
              },
              signal,
            },
          ),
        ),
    },
    files: {
      search: ({ project, bucket, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/buckets/{bucketName}/files/search',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
              },
              body,
              signal,
            },
          ),
        ),
      lookup: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/runtime/projects/{projectRef}/files/lookup', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      createSignedUrls: ({ project, bucket, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/buckets/{bucketName}/files/signed-urls',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
              },
              body,
              signal,
            },
          ),
        ),
      confirm: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/files/confirm',
            {
              params: { path: { projectRef: project } },
              body,
              signal,
            },
          ),
        ),
      delete: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/runtime/projects/{projectRef}/files/delete', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      restore: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/files/restore',
            {
              params: { path: { projectRef: project } },
              body,
              signal,
            },
          ),
        ),
    },
    uploads: {
      upload: (input) => uploadRuntimeFile(transport, input, uploadDefaults),
      uploadFromUrl: (input) =>
        uploadRuntimeFileFromUrl(transport, input, uploadDefaults),
      request: ({ project, bucket, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/buckets/{bucketName}/uploads',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
                header: { 'idempotency-key': idempotencyKey },
              },
              body,
              signal,
            },
          ),
        ),
      get: ({ project, uploadId, signal }) =>
        transport.execute(() =>
          transport.client.GET(
            '/runtime/projects/{projectRef}/uploads/{uploadId}',
            {
              params: { path: { projectRef: project, uploadId } },
              signal,
            },
          ),
        ),
      cancel: ({ project, uploadId, signal }) =>
        transport.execute(() =>
          transport.client.DELETE(
            '/runtime/projects/{projectRef}/uploads/{uploadId}',
            {
              params: { path: { projectRef: project, uploadId } },
              signal,
            },
          ),
        ),
      createParts: ({ project, uploadId, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/uploads/{uploadId}/parts',
            {
              params: { path: { projectRef: project, uploadId } },
              body,
              signal,
            },
          ),
        ),
      completeMultipart: ({ project, uploadId, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/runtime/projects/{projectRef}/uploads/{uploadId}/complete',
            {
              params: { path: { projectRef: project, uploadId } },
              body,
              signal,
            },
          ),
        ),
    },
  };
}

export function createProjectRuntimeClient(
  transport: Transport,
  uploadDefaults?: UploadDefaults,
): ProjectRuntimeClient {
  const runtime = createExplicitProjectRuntimeClient(transport, uploadDefaults);
  const project = '_current';

  return {
    accessTokens: {
      create: (input) => runtime.accessTokens.create({ ...input, project }),
    },
    projects: {
      get: (options) => runtime.projects.get({ ...options, project }),
    },
    buckets: {
      list: (options) => runtime.buckets.list({ ...options, project }),
      get: (input) => runtime.buckets.get({ ...input, project }),
    },
    files: {
      search: (input) => runtime.files.search({ ...input, project }),
      lookup: (input) => runtime.files.lookup({ ...input, project }),
      createSignedUrls: (input) =>
        runtime.files.createSignedUrls({ ...input, project }),
      confirm: (input) => runtime.files.confirm({ ...input, project }),
      delete: (input) => runtime.files.delete({ ...input, project }),
      restore: (input) => runtime.files.restore({ ...input, project }),
    },
    uploads: {
      upload: (input) => runtime.uploads.upload({ ...input, project }),
      uploadFromUrl: (input) =>
        runtime.uploads.uploadFromUrl({ ...input, project }),
      request: (input) => runtime.uploads.request({ ...input, project }),
      get: (input) => runtime.uploads.get({ ...input, project }),
      cancel: (input) => runtime.uploads.cancel({ ...input, project }),
      createParts: (input) =>
        runtime.uploads.createParts({ ...input, project }),
      completeMultipart: (input) =>
        runtime.uploads.completeMultipart({ ...input, project }),
    },
  };
}
