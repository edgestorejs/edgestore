import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { EdgeStoreFileMutationError } from './errors';
import type { RuntimeCallOptions } from './runtime';
import { createEdgeStoreSdk } from './sdk';

describe('createEdgeStoreSdk', () => {
  it('uses the current project implicitly for project credentials', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe(
        'https://example.com/v2/runtime/projects/_current',
      );
      expect(request.headers.get('authorization')).toBe(
        'Basic cHJvamVjdDpzZWNyZXQ=',
      );
      return Response.json({ data: { project: { id: 'project-id' } } });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    const result = await sdk.runtime.projects.get();

    expect(result.project.id).toBe('project-id');
    expectTypeOf(sdk).not.toHaveProperty('management');
    type ProjectGet = typeof sdk.runtime.projects.get;
    expectTypeOf<ProjectGet>()
      .parameter(0)
      .toEqualTypeOf<RuntimeCallOptions | undefined>();
  });

  it('requires an explicit project for management credentials', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe(
        'https://example.com/v2/runtime/projects/project-id/buckets/documents',
      );
      expect(request.headers.get('authorization')).toBe(
        'Bearer management-token',
      );
      return Response.json({ data: { bucket: { name: 'documents' } } });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { token: 'management-token' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    const result = await sdk.runtime.buckets.get({
      project: 'project-id',
      bucket: 'documents',
    });

    expect(result.bucket.name).toBe('documents');
    type ProjectGet = typeof sdk.runtime.projects.get;
    expectTypeOf<ProjectGet>().parameter(0).toMatchTypeOf<{
      project: string;
    }>();
  });

  it('maps upload idempotency and request fields to the API contract', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.method).toBe('POST');
      expect(request.url).toBe(
        'https://example.com/v2/runtime/projects/_current/buckets/documents/uploads',
      );
      expect(request.headers.get('idempotency-key')).toBe('upload-123');
      await expect(request.json()).resolves.toEqual({
        bucketType: 'file',
        sizeBytes: 42,
        fileName: 'invoice.pdf',
      });
      return Response.json({
        data: {
          file: { id: 'file-id' },
          upload: { kind: 'single', id: 'upload-id', signedUrl: 'https://put' },
        },
      });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    const result = await sdk.runtime.uploads.request({
      bucket: 'documents',
      bucketType: 'file',
      sizeBytes: 42,
      fileName: 'invoice.pdf',
      idempotencyKey: 'upload-123',
    });

    expect(result.upload.id).toBe('upload-id');
  });

  it('throws singular file failures and preserves plural partial results', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      const body = (await request.json()) as { files: { id: string }[] };
      if (body.files.length === 1) {
        return Response.json({
          data: {
            results: [
              {
                fileRef: body.files[0],
                success: false,
                error: {
                  code: 'FILE_NOT_DELETABLE',
                  message: 'Cannot delete this file',
                },
              },
            ],
            successCount: 0,
            failureCount: 1,
          },
        });
      }
      return Response.json({
        data: {
          results: [
            { fileRef: body.files[0], success: true },
            {
              fileRef: body.files[1],
              success: false,
              error: {
                code: 'INVALID_FILE_REF',
                message: 'Missing file',
              },
            },
          ],
          successCount: 1,
          failureCount: 1,
        },
      });
    });
    const sdk = createEdgeStoreSdk({
      credentials: { accessKey: 'project', secretKey: 'secret' },
      baseUrl: 'https://example.com/v2',
      fetch,
    });

    await expect(
      sdk.runtime.files.delete({ file: { id: 'first' } }),
    ).rejects.toBeInstanceOf(EdgeStoreFileMutationError);
    await expect(
      sdk.runtime.files.deleteMany({
        files: [{ id: 'first' }, { id: 'missing' }],
      }),
    ).resolves.toMatchObject({ successCount: 1, failureCount: 1 });
  });
});
