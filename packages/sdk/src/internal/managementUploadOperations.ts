import type { OperationBody, OperationResult } from './operationTypes';
import type { Transport } from './transport';

type ProjectUploadInput = {
  project: string;
  uploadId: string;
  signal?: AbortSignal;
};

export type ManagementUploadOperations = ReturnType<
  typeof createManagementUploadOperations
>;

export function createManagementUploadOperations(transport: Transport) {
  return {
    request: (
      input: OperationBody<'v2.management.uploads.request'> & {
        project: string;
        bucket: string;
        signal?: AbortSignal;
      },
    ): Promise<OperationResult<'v2.management.uploads.request'>> => {
      const { project, bucket, signal, ...body } = input;
      return transport.execute((client) =>
        client.POST(
          '/management/projects/{projectRef}/buckets/{bucketName}/uploads',
          {
            params: { path: { projectRef: project, bucketName: bucket } },
            body,
            signal,
          },
        ),
      );
    },
    get: (
      input: ProjectUploadInput,
    ): Promise<OperationResult<'v2.management.uploads.get'>> =>
      transport.execute((client) =>
        client.GET('/management/projects/{projectRef}/uploads/{uploadId}', {
          params: {
            path: { projectRef: input.project, uploadId: input.uploadId },
          },
          signal: input.signal,
        }),
      ),
    getWithResponse: (input: ProjectUploadInput) =>
      transport.executeWithResponse((client) =>
        client.GET('/management/projects/{projectRef}/uploads/{uploadId}', {
          params: {
            path: { projectRef: input.project, uploadId: input.uploadId },
          },
          signal: input.signal,
        }),
      ),
    cancel: (
      input: ProjectUploadInput,
    ): Promise<OperationResult<'v2.management.uploads.cancel'>> =>
      transport.execute((client) =>
        client.DELETE('/management/projects/{projectRef}/uploads/{uploadId}', {
          params: {
            path: { projectRef: input.project, uploadId: input.uploadId },
          },
          signal: input.signal,
        }),
      ),
    createParts: (
      input: ProjectUploadInput &
        OperationBody<'v2.management.uploads.parts.create'>,
    ): Promise<OperationResult<'v2.management.uploads.parts.create'>> => {
      const { project, uploadId, signal, ...body } = input;
      return transport.execute((client) =>
        client.POST(
          '/management/projects/{projectRef}/uploads/{uploadId}/parts',
          {
            params: { path: { projectRef: project, uploadId } },
            body,
            signal,
          },
        ),
      );
    },
    completeMultipart: (
      input: ProjectUploadInput &
        OperationBody<'v2.management.uploads.multipart.complete'>,
    ): Promise<OperationResult<'v2.management.uploads.multipart.complete'>> => {
      const { project, uploadId, signal, ...body } = input;
      return transport.execute((client) =>
        client.POST(
          '/management/projects/{projectRef}/uploads/{uploadId}/complete',
          {
            params: { path: { projectRef: project, uploadId } },
            body,
            signal,
          },
        ),
      );
    },
  };
}
