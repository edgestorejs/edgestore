import { EdgeStoreFileMutationError } from './errors';
import type { OperationBody, OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';
import { uploadRuntimeFile, uploadRuntimeFileFromUrl } from './upload';
import type {
  RuntimeUploadFromUrlInput,
  RuntimeUploadInput,
  RuntimeUploadResult,
  UploadDefaults,
} from './uploadTypes';

/** Options shared by runtime API calls. */
export type RuntimeCallOptions = {
  /** Cancels the request. */
  signal?: AbortSignal;
};

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
/** File selector accepted by runtime lookup and mutation operations. */
export type RuntimeFileReference = RuntimeFileBatchInput['files'][number];
export type RuntimeFileMutationInput = {
  file: RuntimeFileReference;
} & RuntimeCallOptions;
export type RuntimeFileMutationResult = {
  fileRef: RuntimeFileReference;
};

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

/** Resource-oriented runtime client for a current or explicitly selected project. */
export type RuntimeClient<TMode extends ProjectMode> = {
  accessTokens: {
    /** Creates a short-lived access token carrying trusted application context. */
    create(
      input: ScopedInput<TMode, RuntimeAccessTokenCreateInput>,
    ): Promise<RuntimeAccessTokenCreateResult>;
  };
  projects: {
    /** Gets the project visible to the current credential. */
    get(...args: ProjectCallArgs<TMode>): Promise<RuntimeProjectGetResult>;
  };
  buckets: {
    /** Lists the project's buckets. */
    list(...args: ProjectCallArgs<TMode>): Promise<RuntimeBucketListResult>;
    /** Gets one bucket by name. */
    get(
      input: ScopedInput<TMode, RuntimeBucketGetInput>,
    ): Promise<RuntimeBucketGetResult>;
  };
  files: {
    /** Searches files in a bucket using filters, sorting, and cursor pagination. */
    search(
      input: ScopedInput<TMode, RuntimeFileSearchInput>,
    ): Promise<RuntimeFileSearchResult>;
    /** Looks up one file by ID, key, or URL. */
    lookup(
      input: ScopedInput<TMode, RuntimeFileLookupInput>,
    ): Promise<RuntimeFileLookupResult>;
    /** Creates temporary read URLs for protected files. */
    createSignedUrls(
      input: ScopedInput<TMode, RuntimeSignedUrlsCreateInput>,
    ): Promise<RuntimeSignedUrlsCreateResult>;
    /**
     * Confirms one uploaded file.
     *
     * @throws {@link EdgeStoreFileMutationError} when the file cannot be
     * confirmed. Use `confirmMany` to preserve per-file partial results.
     */
    confirm(
      input: ScopedInput<TMode, RuntimeFileMutationInput>,
    ): Promise<RuntimeFileMutationResult>;
    /** Confirms files and returns a success or error result for every item. */
    confirmMany(
      input: ScopedInput<TMode, RuntimeFileBatchInput>,
    ): Promise<RuntimeFileBatchResult>;
    /**
     * Soft-deletes one file.
     *
     * @throws {@link EdgeStoreFileMutationError} when the file cannot be
     * deleted. Use `deleteMany` to preserve per-file partial results.
     */
    delete(
      input: ScopedInput<TMode, RuntimeFileMutationInput>,
    ): Promise<RuntimeFileMutationResult>;
    /** Soft-deletes files and returns a result for every item. */
    deleteMany(
      input: ScopedInput<TMode, RuntimeFileBatchInput>,
    ): Promise<RuntimeFileBatchResult>;
    /**
     * Restores one soft-deleted file.
     *
     * @throws {@link EdgeStoreFileMutationError} when the file cannot be
     * restored. Use `restoreMany` to preserve per-file partial results.
     */
    restore(
      input: ScopedInput<TMode, RuntimeFileMutationInput>,
    ): Promise<RuntimeFileMutationResult>;
    /** Restores files and returns a result for every item. */
    restoreMany(
      input: ScopedInput<TMode, RuntimeFileBatchInput>,
    ): Promise<RuntimeFileBatchResult>;
  };
  uploads: {
    /**
     * Uploads a source and waits for server-side processing to complete.
     *
     * Automatically selects multipart mode, retries retryable setup and
     * storage requests, reports progress, and cancels an incomplete upload
     * after a transfer failure.
     */
    upload(
      input: ScopedInput<TMode, RuntimeUploadInput>,
    ): Promise<RuntimeUploadResult>;
    /**
     * Fetches a URL in the current process, uploads it, and waits for
     * server-side processing to complete.
     *
     * The remote response must include a valid `Content-Length` header.
     */
    uploadFromUrl(
      input: ScopedInput<TMode, RuntimeUploadFromUrlInput>,
    ): Promise<RuntimeUploadResult>;
    /** Requests signed upload destination(s) without transferring data. */
    request(
      input: ScopedInput<TMode, RuntimeUploadRequestInput>,
    ): Promise<RuntimeUploadRequestResult>;
    /** Gets the current upload and processing state. */
    get(
      input: ScopedInput<TMode, RuntimeUploadGetInput>,
    ): Promise<RuntimeUploadGetResult>;
    /** Cancels an incomplete upload. */
    cancel(
      input: ScopedInput<TMode, RuntimeUploadCancelInput>,
    ): Promise<RuntimeUploadCancelResult>;
    /** Requests additional signed URLs for multipart upload parts. */
    createParts(
      input: ScopedInput<TMode, RuntimeUploadPartsCreateInput>,
    ): Promise<RuntimeUploadPartsCreateResult>;
    /** Completes a multipart transfer and begins server-side processing. */
    completeMultipart(
      input: ScopedInput<TMode, RuntimeUploadCompleteInput>,
    ): Promise<RuntimeUploadCompleteResult>;
  };
};

/** Runtime client scoped to the project credential's current project. */
export type ProjectRuntimeClient = RuntimeClient<'current'>;
/** Runtime client whose calls require an explicit project ID or slug. */
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
      confirm: async ({ project, file, signal }) =>
        unwrapFileMutationResult(
          await executeFileMutation(transport, 'confirm', {
            project,
            files: [file],
            signal,
          }),
        ),
      confirmMany: (input) => executeFileMutation(transport, 'confirm', input),
      delete: async ({ project, file, signal }) =>
        unwrapFileMutationResult(
          await executeFileMutation(transport, 'delete', {
            project,
            files: [file],
            signal,
          }),
        ),
      deleteMany: (input) => executeFileMutation(transport, 'delete', input),
      restore: async ({ project, file, signal }) =>
        unwrapFileMutationResult(
          await executeFileMutation(transport, 'restore', {
            project,
            files: [file],
            signal,
          }),
        ),
      restoreMany: (input) => executeFileMutation(transport, 'restore', input),
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
      confirmMany: (input) => runtime.files.confirmMany({ ...input, project }),
      delete: (input) => runtime.files.delete({ ...input, project }),
      deleteMany: (input) => runtime.files.deleteMany({ ...input, project }),
      restore: (input) => runtime.files.restore({ ...input, project }),
      restoreMany: (input) => runtime.files.restoreMany({ ...input, project }),
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

function executeFileMutation(
  transport: Transport,
  operation: 'confirm' | 'delete' | 'restore',
  input: RuntimeFileBatchInput & { project: string },
): Promise<RuntimeFileBatchResult> {
  const { project, signal, ...body } = input;
  const request = (
    path:
      | '/runtime/projects/{projectRef}/files/confirm'
      | '/runtime/projects/{projectRef}/files/delete'
      | '/runtime/projects/{projectRef}/files/restore',
  ) =>
    transport.execute(() =>
      transport.client.POST(path, {
        params: { path: { projectRef: project } },
        body,
        signal,
      }),
    );

  if (operation === 'confirm') {
    return request('/runtime/projects/{projectRef}/files/confirm');
  }
  if (operation === 'delete') {
    return request('/runtime/projects/{projectRef}/files/delete');
  }
  return request('/runtime/projects/{projectRef}/files/restore');
}

function unwrapFileMutationResult(
  result: RuntimeFileBatchResult,
): RuntimeFileMutationResult {
  const item = result.results[0];
  if (!item) {
    throw new Error('EdgeStore returned no file mutation result.');
  }
  if (!item.success) {
    throw new EdgeStoreFileMutationError(
      item.error.code,
      item.error.message,
      item.fileRef,
    );
  }
  return { fileRef: item.fileRef };
}
