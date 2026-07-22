import type {
  OperationBody,
  OperationId,
  OperationQuery,
  OperationResult,
} from './internal/operationTypes';
import type { Transport } from './internal/transport';

type CallOptions = { signal?: AbortSignal };
type AccountInput = { account: string };
type ProjectInput = { project: string };
type BucketInput = ProjectInput & { bucket: string };
type UploadInput = ProjectInput & { uploadId: string };
type EmptyJobInput = BucketInput & { jobId: string };
type Idempotent = { idempotencyKey?: string };

type Result<TOperation extends OperationId> = OperationResult<TOperation>;

export type ManagementResourceClient = {
  projects: {
    list(
      input: AccountInput & CallOptions,
    ): Promise<Result<'v2.management.projects.list'>>;
    create(
      input: AccountInput &
        OperationBody<'v2.management.projects.create'> &
        Idempotent &
        CallOptions,
    ): Promise<Result<'v2.management.projects.create'>>;
    get(
      input: ProjectInput & CallOptions,
    ): Promise<Result<'v2.management.projects.get'>>;
    delete(
      input: ProjectInput & CallOptions,
    ): Promise<Result<'v2.management.projects.delete'>>;
  };
  buckets: {
    list(
      input: ProjectInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.list'>>;
    create(
      input: ProjectInput &
        OperationBody<'v2.management.buckets.create'> &
        Idempotent &
        CallOptions,
    ): Promise<Result<'v2.management.buckets.create'>>;
    get(
      input: BucketInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.get'>>;
    update(
      input: BucketInput &
        OperationBody<'v2.management.buckets.update'> &
        CallOptions,
    ): Promise<Result<'v2.management.buckets.update'>>;
    delete(
      input: BucketInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.delete'>>;
    empty(
      input: BucketInput & CallOptions,
    ): Promise<Result<'v2.management.buckets.empty'>>;
    emptyJobs: {
      latest(
        input: BucketInput & CallOptions,
      ): Promise<Result<'v2.management.buckets.emptyJobs.latest'>>;
      get(
        input: EmptyJobInput & CallOptions,
      ): Promise<Result<'v2.management.buckets.emptyJobs.get'>>;
      retry(
        input: EmptyJobInput & CallOptions,
      ): Promise<Result<'v2.management.buckets.emptyJobs.retry'>>;
    };
  };
  files: {
    list(
      input: BucketInput &
        OperationQuery<'v2.management.files.list'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.list'>>;
    lookup(
      input: ProjectInput &
        OperationBody<'v2.management.files.lookup'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.lookup'>>;
    createDownloadUrls(
      input: ProjectInput &
        OperationBody<'v2.management.files.downloadUrls.create'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.downloadUrls.create'>>;
    delete(
      input: ProjectInput &
        OperationBody<'v2.management.files.delete'> &
        CallOptions,
    ): Promise<Result<'v2.management.files.delete'>>;
  };
  uploads: {
    request(
      input: BucketInput &
        OperationBody<'v2.management.uploads.request'> &
        Idempotent &
        CallOptions,
    ): Promise<Result<'v2.management.uploads.request'>>;
    get(
      input: UploadInput & CallOptions,
    ): Promise<Result<'v2.management.uploads.get'>>;
    cancel(
      input: UploadInput & CallOptions,
    ): Promise<Result<'v2.management.uploads.cancel'>>;
    createParts(
      input: UploadInput &
        OperationBody<'v2.management.uploads.parts.create'> &
        CallOptions,
    ): Promise<Result<'v2.management.uploads.parts.create'>>;
    completeMultipart(
      input: UploadInput &
        OperationBody<'v2.management.uploads.multipart.complete'> &
        CallOptions,
    ): Promise<Result<'v2.management.uploads.multipart.complete'>>;
  };
};

export function createManagementResourceClient(
  transport: Transport,
): ManagementResourceClient {
  return {
    projects: {
      list: ({ account, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/accounts/{accountId}/projects', {
            params: { path: { accountId: account } },
            signal,
          }),
        ),
      create: ({ account, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/management/accounts/{accountId}/projects', {
            params: {
              path: { accountId: account },
              header: { 'idempotency-key': idempotencyKey },
            },
            body,
            signal,
          }),
        ),
      get: ({ project, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/projects/{projectRef}', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      delete: ({ project, signal }) =>
        transport.execute(() =>
          transport.client.DELETE('/management/projects/{projectRef}', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
    },
    buckets: {
      list: ({ project, signal }) =>
        transport.execute(() =>
          transport.client.GET('/management/projects/{projectRef}/buckets', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      create: ({ project, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST('/management/projects/{projectRef}/buckets', {
            params: {
              path: { projectRef: project },
              header: { 'idempotency-key': idempotencyKey },
            },
            body,
            signal,
          }),
        ),
      get: ({ project, bucket, signal }) =>
        transport.execute(() =>
          transport.client.GET(
            '/management/projects/{projectRef}/buckets/{bucketName}',
            {
              params: { path: { projectRef: project, bucketName: bucket } },
              signal,
            },
          ),
        ),
      update: ({ project, bucket, signal, ...body }) =>
        transport.execute(() =>
          transport.client.PATCH(
            '/management/projects/{projectRef}/buckets/{bucketName}',
            {
              params: { path: { projectRef: project, bucketName: bucket } },
              body,
              signal,
            },
          ),
        ),
      delete: ({ project, bucket, signal }) =>
        transport.execute(() =>
          transport.client.DELETE(
            '/management/projects/{projectRef}/buckets/{bucketName}',
            {
              params: { path: { projectRef: project, bucketName: bucket } },
              signal,
            },
          ),
        ),
      empty: ({ project, bucket, signal }) =>
        transport.execute(() =>
          transport.client.POST(
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
          transport.execute(() =>
            transport.client.GET(
              '/management/projects/{projectRef}/buckets/{bucketName}/empty-job',
              {
                params: { path: { projectRef: project, bucketName: bucket } },
                signal,
              },
            ),
          ),
        get: ({ project, bucket, jobId, signal }) =>
          transport.execute(() =>
            transport.client.GET(
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
          transport.execute(() =>
            transport.client.POST(
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
      list: ({ project, bucket, cursor, limit, signal }) =>
        transport.execute(() =>
          transport.client.GET(
            '/management/projects/{projectRef}/buckets/{bucketName}/files',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
                query: { cursor, limit },
              },
              signal,
            },
          ),
        ),
      lookup: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/projects/{projectRef}/files/lookup',
            {
              params: { path: { projectRef: project } },
              body,
              signal,
            },
          ),
        ),
      createDownloadUrls: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/projects/{projectRef}/files/download-urls',
            {
              params: { path: { projectRef: project } },
              body,
              signal,
            },
          ),
        ),
      delete: ({ project, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/projects/{projectRef}/files/delete',
            {
              params: { path: { projectRef: project } },
              body,
              signal,
            },
          ),
        ),
    },
    uploads: {
      request: ({ project, bucket, idempotencyKey, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/projects/{projectRef}/buckets/{bucketName}/uploads',
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
            '/management/projects/{projectRef}/uploads/{uploadId}',
            {
              params: { path: { projectRef: project, uploadId } },
              signal,
            },
          ),
        ),
      cancel: ({ project, uploadId, signal }) =>
        transport.execute(() =>
          transport.client.DELETE(
            '/management/projects/{projectRef}/uploads/{uploadId}',
            {
              params: { path: { projectRef: project, uploadId } },
              signal,
            },
          ),
        ),
      createParts: ({ project, uploadId, signal, ...body }) =>
        transport.execute(() =>
          transport.client.POST(
            '/management/projects/{projectRef}/uploads/{uploadId}/parts',
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
