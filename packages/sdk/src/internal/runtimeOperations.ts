import type {
  ExplicitProjectRuntimeClient,
  RuntimeFileConfirmInput,
  RuntimeFileDeleteInput,
  RuntimeFileRestoreInput,
} from '../runtime';
import type { Transport } from './transport';

type Explicit<TInput> = TInput & { project: string };

export type RuntimeOperations = ExplicitProjectRuntimeClient;

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
      createSignedUrls: ({ project, bucket, signal, ...body }) =>
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
      confirm: ({ project, signal, ...body }) =>
        executeFileMutation(transport, 'confirm', { project, signal, ...body }),
      delete: ({ project, signal, ...body }) =>
        executeFileMutation(transport, 'delete', { project, signal, ...body }),
      restore: ({ project, signal, ...body }) =>
        executeFileMutation(transport, 'restore', { project, signal, ...body }),
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
      get: ({ project, uploadId, signal }) =>
        transport.execute((client) =>
          client.GET('/runtime/projects/{projectRef}/uploads/{uploadId}', {
            params: { path: { projectRef: project, uploadId } },
            signal,
          }),
        ),
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

type FileMutationInput =
  | Explicit<RuntimeFileConfirmInput>
  | Explicit<RuntimeFileDeleteInput>
  | Explicit<RuntimeFileRestoreInput>;

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
