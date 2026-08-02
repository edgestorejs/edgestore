import type {
  OperationBody,
  OperationId,
  OperationQuery,
  OperationResult,
} from './internal/operationTypes';
import type { Transport } from './internal/transport';
import {
  uploadManagementFile,
  type ManagementUploadInput,
  type ManagementUploadResult,
} from './managementUpload';
import type { UploadDefaults } from './uploadTypes';

type CallOptions = {
  /** Cancels the request. */
  signal?: AbortSignal;
};
type AccountInput = {
  /** Account ID. */
  account: string;
};
type ProjectInput = {
  /** Project ID or slug. */
  project: string;
};
type BucketInput = ProjectInput & {
  /** Bucket name. */
  bucket: string;
};
type UploadInput = ProjectInput & {
  /** Upload ID. */
  uploadId: string;
};
type EmptyJobInput = BucketInput & {
  /** Empty-bucket job ID. */
  jobId: string;
};

type Result<TOperation extends OperationId> = OperationResult<TOperation>;

/** Management operations for projects, buckets, files, and uploads. */
export type ManagementResourceClient = {
  projects: {
    /** Lists projects in an account. */
    list(
      input: AccountInput & CallOptions,
    ): Promise<Result<'v2.management.projects.list'>>;
    /** Creates a project in an account. */
    create(
      input: AccountInput &
        OperationBody<'v2.management.projects.create'> &
        CallOptions,
    ): Promise<Result<'v2.management.projects.create'>>;
    /** Gets a project by ID or slug. */
    get(
      input: ProjectInput & CallOptions,
    ): Promise<Result<'v2.management.projects.get'>>;
    /** Deletes a project. */
    delete(
      input: ProjectInput & CallOptions,
    ): Promise<Result<'v2.management.projects.delete'>>;
  };
  buckets: {
    /** Lists buckets in a project. */
    list(
      input: ProjectInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.list'>>;
    /** Creates a bucket. */
    create(
      input: ProjectInput &
        OperationBody<'v2.management.buckets.create'> &
        CallOptions,
    ): Promise<Result<'v2.management.buckets.create'>>;
    /** Gets a bucket by name. */
    get(
      input: BucketInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.get'>>;
    /** Updates a bucket. */
    update(
      input: BucketInput &
        OperationBody<'v2.management.buckets.update'> &
        CallOptions,
    ): Promise<Result<'v2.management.buckets.update'>>;
    /** Deletes an empty bucket. */
    delete(
      input: BucketInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.delete'>>;
    /** Starts an asynchronous job that deletes every file in a bucket. */
    empty(
      input: BucketInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.empty'>>;
    emptyJobs: {
      /** Gets the latest empty-bucket job, or `null` when no job exists. */
      latest(
        input: BucketInput & CallOptions,
      ): Promise<Result<'v2.management.buckets.emptyJobs.latest'>>;
      /** Gets an empty-bucket job by ID. */
      get(
        input: EmptyJobInput & CallOptions,
      ): Promise<Result<'v2.management.buckets.emptyJobs.get'>>;
      /** Retries the failed items in an empty-bucket job. */
      retry(
        input: EmptyJobInput & CallOptions,
      ): Promise<Result<'v2.management.buckets.emptyJobs.retry'>>;
    };
  };
  files: {
    /** Lists files in a bucket using cursor pagination. */
    list(
      input: BucketInput &
        OperationQuery<'v2.management.files.list'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.list'>>;
    /** Looks up one file by ID, key, or URL. */
    lookup(
      input: ProjectInput &
        OperationBody<'v2.management.files.lookup'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.lookup'>>;
    /** Generates read-access URLs for public and protected files. */
    generateAccessUrls(
      input: ProjectInput &
        OperationBody<'v2.management.files.generateAccessUrls'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.generateAccessUrls'>>;
    /** Deletes files and preserves a result for every requested item. */
    delete(
      input: ProjectInput &
        OperationBody<'v2.management.files.delete'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.delete'>>;
  };
  uploads: {
    /** Transfers a file and waits for server-side processing to complete. */
    upload(input: ManagementUploadInput): Promise<ManagementUploadResult>;
    /** Requests signed upload destination(s) without transferring data. */
    request(
      input: BucketInput &
        OperationBody<'v2.management.uploads.request'> &
        CallOptions,
    ): Promise<Result<'v2.management.uploads.request'>>;
    /** Gets the current upload and processing state. */
    get(
      input: UploadInput & CallOptions,
    ): Promise<Result<'v2.management.uploads.get'>>;
    /** Cancels an incomplete upload. */
    cancel(
      input: UploadInput & CallOptions,
    ): Promise<Result<'v2.management.uploads.cancel'>>;
    /** Requests additional signed URLs for multipart upload parts. */
    createParts(
      input: UploadInput &
        OperationBody<'v2.management.uploads.parts.create'> &
        CallOptions,
    ): Promise<Result<'v2.management.uploads.parts.create'>>;
    /** Completes a multipart transfer and begins server-side processing. */
    completeMultipart(
      input: UploadInput &
        OperationBody<'v2.management.uploads.multipart.complete'> &
        CallOptions,
    ): Promise<Result<'v2.management.uploads.multipart.complete'>>;
  };
};

export function createManagementResourceClient(
  transport: Transport,
  uploadDefaults: UploadDefaults = {},
): ManagementResourceClient {
  return {
    projects: {
      list: ({ account, signal }) =>
        transport.execute((client) =>
          client.GET('/management/accounts/{accountId}/projects', {
            params: { path: { accountId: account } },
            signal,
          }),
        ),
      create: ({ account, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/accounts/{accountId}/projects', {
            params: { path: { accountId: account } },
            body,
            signal,
          }),
        ),
      get: ({ project, signal }) =>
        transport.execute((client) =>
          client.GET('/management/projects/{projectRef}', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      delete: ({ project, signal }) =>
        transport.execute((client) =>
          client.DELETE('/management/projects/{projectRef}', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
    },
    buckets: {
      list: ({ project, signal }) =>
        transport.execute((client) =>
          client.GET('/management/projects/{projectRef}/buckets', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      create: ({ project, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/projects/{projectRef}/buckets', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      get: ({ project, bucket, signal }) =>
        transport.execute((client) =>
          client.GET('/management/projects/{projectRef}/buckets/{bucketName}', {
            params: { path: { projectRef: project, bucketName: bucket } },
            signal,
          }),
        ),
      update: ({ project, bucket, signal, ...body }) =>
        transport.execute((client) =>
          client.PATCH(
            '/management/projects/{projectRef}/buckets/{bucketName}',
            {
              params: { path: { projectRef: project, bucketName: bucket } },
              body,
              signal,
            },
          ),
        ),
      delete: ({ project, bucket, signal }) =>
        transport.execute((client) =>
          client.DELETE(
            '/management/projects/{projectRef}/buckets/{bucketName}',
            {
              params: { path: { projectRef: project, bucketName: bucket } },
              signal,
            },
          ),
        ),
      empty: ({ project, bucket, signal }) =>
        transport.execute((client) =>
          client.POST(
            '/management/projects/{projectRef}/buckets/{bucketName}/empty',
            {
              params: { path: { projectRef: project, bucketName: bucket } },
              body: {},
              signal,
            },
          ),
        ),
      emptyJobs: {
        latest: ({ project, bucket, signal }) =>
          transport.execute((client) =>
            client.GET(
              '/management/projects/{projectRef}/buckets/{bucketName}/empty-job',
              {
                params: { path: { projectRef: project, bucketName: bucket } },
                signal,
              },
            ),
          ),
        get: ({ project, bucket, jobId, signal }) =>
          transport.execute((client) =>
            client.GET(
              '/management/projects/{projectRef}/buckets/{bucketName}/empty-jobs/{jobId}',
              {
                params: {
                  path: { projectRef: project, bucketName: bucket, jobId },
                },
                signal,
              },
            ),
          ),
        retry: ({ project, bucket, jobId, signal }) =>
          transport.execute((client) =>
            client.POST(
              '/management/projects/{projectRef}/buckets/{bucketName}/empty-jobs/{jobId}/retry',
              {
                params: {
                  path: { projectRef: project, bucketName: bucket, jobId },
                },
                body: {},
                signal,
              },
            ),
          ),
      },
    },
    files: {
      list: ({ project, bucket, signal, ...query }) =>
        transport.execute((client) =>
          client.GET(
            '/management/projects/{projectRef}/buckets/{bucketName}/files',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
                query,
              },
              signal,
            },
          ),
        ),
      lookup: ({ project, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/projects/{projectRef}/files/lookup', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      generateAccessUrls: ({ project, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/projects/{projectRef}/files/access-urls', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      delete: ({ project, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/management/projects/{projectRef}/files/delete', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
    },
    uploads: {
      upload: (input) => uploadManagementFile(transport, input, uploadDefaults),
      request: ({ project, bucket, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
            '/management/projects/{projectRef}/buckets/{bucketName}/uploads',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
              },
              body,
              signal,
            },
          ),
        ),
      get: ({ project, uploadId, signal }) =>
        transport.execute((client) =>
          client.GET('/management/projects/{projectRef}/uploads/{uploadId}', {
            params: { path: { projectRef: project, uploadId } },
            signal,
          }),
        ),
      cancel: ({ project, uploadId, signal }) =>
        transport.execute((client) =>
          client.DELETE(
            '/management/projects/{projectRef}/uploads/{uploadId}',
            {
              params: { path: { projectRef: project, uploadId } },
              signal,
            },
          ),
        ),
      createParts: ({ project, uploadId, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
            '/management/projects/{projectRef}/uploads/{uploadId}/parts',
            {
              params: { path: { projectRef: project, uploadId } },
              body,
              signal,
            },
          ),
        ),
      completeMultipart: ({ project, uploadId, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
            '/management/projects/{projectRef}/uploads/{uploadId}/complete',
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
