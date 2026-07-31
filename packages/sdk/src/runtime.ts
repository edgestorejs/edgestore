import type { OperationBody, OperationResult } from './internal/operationTypes';
import {
  scopeProjectOperations,
  type ProjectOperationTree,
} from './internal/projectOperation';
import {
  createRuntimeOperations,
  type RuntimeOperations,
} from './internal/runtimeOperations';
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
export type RuntimeSignedReadUrlsGenerateInput = {
  bucket: string;
} & OperationBody<'v2.runtime.files.generateSignedReadUrls'> &
  RuntimeCallOptions;
export type RuntimeSignedReadUrlsGenerateResult =
  OperationResult<'v2.runtime.files.generateSignedReadUrls'>;
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

type FileMutationInput<TBatchInput extends { files: unknown[] }> = Omit<
  TBatchInput,
  'files'
> & {
  file: TBatchInput['files'][number];
};
type FileMutationResult<TResult extends { results: unknown[] }> =
  TResult['results'][number] extends infer TItem
    ? Extract<TItem, { success: true }> extends { fileRef: infer TFileRef }
      ? { fileRef: TFileRef }
      : never
    : never;

/** File selector accepted by runtime lookup and mutation operations. */
export type RuntimeFileReference =
  | RuntimeFileConfirmInput['files'][number]
  | RuntimeFileDeleteInput['files'][number]
  | RuntimeFileRestoreInput['files'][number];
export type RuntimeFileConfirmOneInput =
  FileMutationInput<RuntimeFileConfirmInput>;
export type RuntimeFileConfirmOneResult =
  FileMutationResult<RuntimeFileConfirmResult>;
export type RuntimeFileDeleteOneInput =
  FileMutationInput<RuntimeFileDeleteInput>;
export type RuntimeFileDeleteOneResult =
  FileMutationResult<RuntimeFileDeleteResult>;
export type RuntimeFileRestoreOneInput =
  FileMutationInput<RuntimeFileRestoreInput>;
export type RuntimeFileRestoreOneResult =
  FileMutationResult<RuntimeFileRestoreResult>;

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
    /** Generates temporary signed read URLs for protected files. */
    generateSignedReadUrls(
      input: ScopedInput<TMode, RuntimeSignedReadUrlsGenerateInput>,
    ): Promise<RuntimeSignedReadUrlsGenerateResult>;
    /**
     * Confirms one uploaded file.
     *
     * @throws {@link EdgeStoreFileMutationError} when the file cannot be
     * confirmed. Use `confirmMany` to preserve per-file partial results.
     */
    confirm(
      input: ScopedInput<TMode, RuntimeFileConfirmOneInput>,
    ): Promise<RuntimeFileConfirmOneResult>;
    /** Confirms files and returns a success or error result for every item. */
    confirmMany(
      input: ScopedInput<TMode, RuntimeFileConfirmInput>,
    ): Promise<RuntimeFileConfirmResult>;
    /**
     * Soft-deletes one file.
     *
     * @throws {@link EdgeStoreFileMutationError} when the file cannot be
     * deleted. Use `deleteMany` to preserve per-file partial results.
     */
    delete(
      input: ScopedInput<TMode, RuntimeFileDeleteOneInput>,
    ): Promise<RuntimeFileDeleteOneResult>;
    /** Soft-deletes files and returns a result for every item. */
    deleteMany(
      input: ScopedInput<TMode, RuntimeFileDeleteInput>,
    ): Promise<RuntimeFileDeleteResult>;
    /**
     * Restores one soft-deleted file.
     *
     * @throws {@link EdgeStoreFileMutationError} when the file cannot be
     * restored. Use `restoreMany` to preserve per-file partial results.
     */
    restore(
      input: ScopedInput<TMode, RuntimeFileRestoreOneInput>,
    ): Promise<RuntimeFileRestoreOneResult>;
    /** Restores files and returns a result for every item. */
    restoreMany(
      input: ScopedInput<TMode, RuntimeFileRestoreInput>,
    ): Promise<RuntimeFileRestoreResult>;
  };
  uploads: {
    /**
     * Uploads a source and waits for server-side processing to complete.
     *
     * Automatically selects multipart mode, retries transient signed storage
     * failures, reports progress, and cancels an incomplete upload after a
     * transfer failure. Upload creation is never retried.
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
/**
 * Runtime client whose calls either require a project or can be scoped once
 * with {@link ExplicitProjectRuntimeClient.forProject}.
 */
export type ExplicitProjectRuntimeClient = ProjectOperationTree<
  RuntimeClient<'explicit'>
> & {
  /** Creates an eagerly built runtime client scoped to one project. */
  forProject(project: string): ProjectRuntimeClient;
};

export function createExplicitProjectRuntimeClient(
  transport: Transport,
  uploadDefaults?: UploadDefaults,
): ExplicitProjectRuntimeClient {
  const operations = createExplicitProjectRuntimeOperations(
    transport,
    uploadDefaults,
  );

  return {
    ...operations,
    forProject: (project) => {
      assertProject(project);
      return scopeProjectOperations(operations, project);
    },
  };
}

function createExplicitProjectRuntimeOperations(
  transport: Transport,
  uploadDefaults?: UploadDefaults,
): ProjectOperationTree<RuntimeClient<'explicit'>> {
  const operations = createRuntimeOperations(transport);
  const uploadContext = { transport, operations };

  return {
    ...operations,
    uploads: {
      ...operations.uploads,
      upload: (input) =>
        uploadRuntimeFile(uploadContext, input, uploadDefaults),
      uploadFromUrl: (input) =>
        uploadRuntimeFileFromUrl(uploadContext, input, uploadDefaults),
    },
  };
}

export function createProjectRuntimeClient(
  transport: Transport,
  uploadDefaults?: UploadDefaults,
): ProjectRuntimeClient {
  return scopeProjectOperations(
    createExplicitProjectRuntimeOperations(transport, uploadDefaults),
    '_current',
  );
}

function assertProject(project: string): void {
  if (typeof project !== 'string' || !project.trim()) {
    throw new TypeError('EdgeStore project must not be empty.');
  }
}

export type { RuntimeOperations };
