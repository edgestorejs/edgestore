import type { Client } from 'openapi-fetch';
import { EdgeStoreFileMutationError } from '../errors';
import type { paths } from '../generated/api-v2';
import type {
  RuntimeClient,
  RuntimeFileConfirmInput,
  RuntimeFileConfirmResult,
  RuntimeFileDeleteInput,
  RuntimeFileDeleteResult,
  RuntimeFileRestoreInput,
  RuntimeFileRestoreResult,
  RuntimeUploadGetInput,
} from '../runtime';
import type { ProjectOperationTree } from './projectOperation';
import type { Transport } from './transport';

type Explicit<TInput> = TInput & { project: string };
type ExplicitUploadGetInput = Explicit<RuntimeUploadGetInput>;

type ExplicitRuntimeClient = RuntimeClient<'explicit'>;
type RuntimeOperationClient = Omit<ExplicitRuntimeClient, 'uploads'> & {
  uploads: Omit<ExplicitRuntimeClient['uploads'], 'upload' | 'uploadFromUrl'>;
};
export type RuntimeOperations = ProjectOperationTree<RuntimeOperationClient>;

export function createRuntimeOperations(
  transport: Transport,
): RuntimeOperations {
  return {
    accessTokens: {
      create: ({ project, signal, ...body }) =>
        transport.execute((client) =>
          client.POST('/runtime/projects/{projectRef}/access-token', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
    },
    projects: {
      get: ({ project, signal }) =>
        transport.execute((client) =>
          client.GET('/runtime/projects/{projectRef}', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
    },
    buckets: {
      list: ({ project, signal }) =>
        transport.execute((client) =>
          client.GET('/runtime/projects/{projectRef}/buckets', {
            params: { path: { projectRef: project } },
            signal,
          }),
        ),
      get: ({ project, bucket, signal }) =>
        transport.execute((client) =>
          client.GET('/runtime/projects/{projectRef}/buckets/{bucketName}', {
            params: {
              path: { projectRef: project, bucketName: bucket },
            },
            signal,
          }),
        ),
    },
    files: {
      search: ({ project, bucket, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
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
        transport.execute((client) =>
          client.POST('/runtime/projects/{projectRef}/files/lookup', {
            params: { path: { projectRef: project } },
            body,
            signal,
          }),
        ),
      generateSignedReadUrls: ({ project, bucket, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
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
      confirm: async ({ project, file, signal, ...body }) =>
        unwrapFileMutationResult(
          await executeFileMutation(transport, 'confirm', {
            project,
            ...body,
            files: [file],
            signal,
          }),
        ),
      confirmMany: (input) => executeFileMutation(transport, 'confirm', input),
      delete: async ({ project, file, signal, ...body }) =>
        unwrapFileMutationResult(
          await executeFileMutation(transport, 'delete', {
            project,
            ...body,
            files: [file],
            signal,
          }),
        ),
      deleteMany: (input) => executeFileMutation(transport, 'delete', input),
      restore: async ({ project, file, signal, ...body }) =>
        unwrapFileMutationResult(
          await executeFileMutation(transport, 'restore', {
            project,
            ...body,
            files: [file],
            signal,
          }),
        ),
      restoreMany: (input) => executeFileMutation(transport, 'restore', input),
    },
    uploads: {
      request: ({ project, bucket, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
            '/runtime/projects/{projectRef}/buckets/{bucketName}/uploads',
            {
              params: {
                path: { projectRef: project, bucketName: bucket },
              },
              body,
              signal,
            },
          ),
        ),
      get: (input) => transport.execute(createGetUploadRequest(input)),
      cancel: ({ project, uploadId, signal }) =>
        transport.execute((client) =>
          client.DELETE('/runtime/projects/{projectRef}/uploads/{uploadId}', {
            params: { path: { projectRef: project, uploadId } },
            signal,
          }),
        ),
      createParts: ({ project, uploadId, signal, ...body }) =>
        transport.execute((client) =>
          client.POST(
            '/runtime/projects/{projectRef}/uploads/{uploadId}/parts',
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

export function createGetUploadRequest({
  project,
  uploadId,
  signal,
}: ExplicitUploadGetInput) {
  return (client: Client<paths>) =>
    client.GET('/runtime/projects/{projectRef}/uploads/{uploadId}', {
      params: { path: { projectRef: project, uploadId } },
      signal,
    });
}

type FileMutationInput =
  | Explicit<RuntimeFileConfirmInput>
  | Explicit<RuntimeFileDeleteInput>
  | Explicit<RuntimeFileRestoreInput>;

function executeFileMutation(
  transport: Transport,
  operation: 'confirm',
  input: Explicit<RuntimeFileConfirmInput>,
): Promise<RuntimeFileConfirmResult>;
function executeFileMutation(
  transport: Transport,
  operation: 'delete',
  input: Explicit<RuntimeFileDeleteInput>,
): Promise<RuntimeFileDeleteResult>;
function executeFileMutation(
  transport: Transport,
  operation: 'restore',
  input: Explicit<RuntimeFileRestoreInput>,
): Promise<RuntimeFileRestoreResult>;
function executeFileMutation(
  transport: Transport,
  operation: 'confirm' | 'delete' | 'restore',
  input: FileMutationInput,
) {
  const { project, signal, ...body } = input;
  const path = `/runtime/projects/{projectRef}/files/${operation}` as const;
  return transport.execute((client) =>
    client.POST(path, {
      params: { path: { projectRef: project } },
      body,
      signal,
    }),
  );
}

function unwrapFileMutationResult<
  TResult extends
    | RuntimeFileConfirmResult
    | RuntimeFileDeleteResult
    | RuntimeFileRestoreResult,
>(result: TResult) {
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
