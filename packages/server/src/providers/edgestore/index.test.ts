import { initEdgeStore } from '@edgestore/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { edgestore } from '.';

const runtime = vi.hoisted(() => ({
  accessTokens: { create: vi.fn() },
  files: {
    lookup: vi.fn(),
    createSignedUrls: vi.fn(),
    search: vi.fn(),
    confirm: vi.fn(),
    confirmMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    restore: vi.fn(),
    restoreMany: vi.fn(),
  },
  uploads: {
    upload: vi.fn(),
    request: vi.fn(),
    createParts: vi.fn(),
    completeMultipart: vi.fn(),
  },
}));

vi.mock('@edgestore/sdk', () => ({
  createEdgeStoreSdk: vi.fn(() => ({ runtime })),
  DEFAULT_MULTIPART_PART_SIZE_BYTES: 16 * 1024 * 1024,
  DEFAULT_MULTIPART_THRESHOLD_BYTES: 100 * 1024 * 1024,
}));

const fileInfo = {
  type: 'text/plain',
  size: 1024,
  extension: 'txt',
  isPublic: true,
  path: [{ key: 'org', value: 'acme' }],
  metadata: { owner: 'user-1', omitted: null },
  temporary: false,
};

describe('edgestore provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a v2 access token from the router', async () => {
    runtime.accessTokens.create.mockResolvedValue({
      token: 'token',
      basePath: '/runtime/projects/_current',
    });
    const es = initEdgeStore.context<{ userId: string }>().create();
    const router = es.router({
      files: es.fileBucket().path(({ ctx }) => [{ userId: ctx.userId }]),
    });
    const provider = edgestore({ accessKey: 'access', secretKey: 'secret' });

    await expect(
      provider.init({ ctx: { userId: 'user-1' }, router }),
    ).resolves.toEqual({ token: 'token' });
    expect(runtime.accessTokens.create).toHaveBeenCalledWith({
      context: { userId: 'user-1' },
      buckets: {
        files: {
          path: [{ key: 'userId', value: expect.any(String) }],
          accessControl: undefined,
        },
      },
    });
  });

  it('maps a single v2 upload and omits nullish metadata', async () => {
    runtime.uploads.request.mockResolvedValue({
      file: {
        url: 'https://files.example/file',
        key: 'files/file',
        thumbnailUrl: null,
      },
      upload: {
        kind: 'single',
        id: 'upload-1',
        signedUrl: 'https://upload.example/file',
      },
    });
    const provider = edgestore({ accessKey: 'access', secretKey: 'secret' });

    await expect(
      provider.requestUpload({
        bucketName: 'files',
        bucketType: 'FILE',
        fileInfo,
      }),
    ).resolves.toEqual({
      accessUrl: 'https://files.example/file',
      thumbnailUrl: null,
      uploadUrl: 'https://upload.example/file',
      accessSignedUrl: undefined,
      accessSignedThumbnailUrl: undefined,
      accessSignedUrlExpiresAt: undefined,
      accessSignedUrlExpiresIn: undefined,
    });
    expect(runtime.uploads.request).toHaveBeenCalledWith({
      bucket: 'files',
      bucketType: 'file',
      visibility: 'public',
      fileName: undefined,
      mimeType: 'text/plain',
      temporary: false,
      path: fileInfo.path,
      extension: 'txt',
      sizeBytes: 1024,
      metadata: { owner: 'user-1' },
      replaceTarget: undefined,
      signedReadUrl: undefined,
    });
  });

  it('requests multipart uploads above the shared threshold', async () => {
    runtime.uploads.request.mockResolvedValue({
      file: {
        url: 'https://files.example/file',
        key: 'files/file',
        thumbnailUrl: null,
      },
      upload: {
        kind: 'multipart',
        id: 'upload-1',
        parts: [{ partNumber: 1, signedUrl: 'https://upload.example/1' }],
      },
    });
    const provider = edgestore({ accessKey: 'access', secretKey: 'secret' });
    const size = 101 * 1024 * 1024;

    const result = await provider.requestUpload({
      bucketName: 'files',
      bucketType: 'FILE',
      fileInfo: { ...fileInfo, size },
    });

    expect(runtime.uploads.request).toHaveBeenCalledWith(
      expect.objectContaining({
        multipart: { partNumbers: [1, 2, 3, 4, 5, 6, 7] },
      }),
    );
    expect(result).toMatchObject({
      multipart: {
        key: 'files/file',
        uploadId: 'upload-1',
        partSize: 16 * 1024 * 1024,
        totalParts: 7,
        parts: [{ partNumber: 1, uploadUrl: 'https://upload.example/1' }],
      },
    });
  });

  it('maps lookup, search, signed URL, confirm, and delete operations', async () => {
    const file = {
      url: 'https://files.example/file',
      thumbnailUrl: null,
      sizeBytes: 12,
      uploadedAt: '2026-07-21T00:00:00.000Z',
      path: { org: 'acme' },
      metadata: { owner: 'user-1' },
    };
    runtime.files.lookup.mockResolvedValue({ file });
    runtime.files.search.mockResolvedValue({
      files: [file],
      pagination: { limit: 20, nextCursor: null, hasMore: false },
    });
    runtime.files.createSignedUrls.mockResolvedValue({ signedUrls: [] });
    runtime.files.confirm.mockResolvedValue({
      results: [{ fileRef: { url: file.url }, success: true }],
      successCount: 1,
      failureCount: 0,
    });
    runtime.files.delete.mockResolvedValue({
      results: [{ fileRef: { url: file.url }, success: true }],
      successCount: 1,
      failureCount: 0,
    });
    const provider = edgestore({ accessKey: 'access', secretKey: 'secret' });

    await expect(provider.getFile({ url: file.url })).resolves.toMatchObject({
      size: 12,
      uploadedAt: new Date(file.uploadedAt),
    });
    await expect(
      provider.listFiles?.({ bucketName: 'files' }),
    ).resolves.toMatchObject({
      data: [{ size: 12 }],
      pagination: { hasMore: false },
    });
    await expect(
      provider.getSignedUrls?.({ bucketName: 'files', urls: [file.url] }),
    ).resolves.toEqual([]);
    await expect(
      provider.confirmUpload({ bucket: {} as never, url: file.url }),
    ).resolves.toEqual({ success: true });
    await expect(
      provider.deleteFile({ bucket: {} as never, url: file.url }),
    ).resolves.toEqual({ success: true });
  });

  it('exposes canonical privileged backend operations through the SDK', async () => {
    const file = {
      id: 'file-id',
      url: 'https://files.example/file',
      key: 'files/file',
      thumbnailUrl: null,
      thumbnailKey: null,
      bucketId: 'bucket-id',
      bucketName: 'files',
      projectId: 'project-id',
      accountId: 'account-id',
      name: 'file.txt',
      path: { org: 'acme' },
      metadata: { owner: 'user-1' },
      sizeBytes: 12,
      mimeType: 'text/plain',
      state: 'uploaded' as const,
      temporary: false,
      uploadedAt: '2026-07-21T00:00:00.000Z',
      updatedAt: '2026-07-21T00:00:01.000Z',
    };
    runtime.uploads.upload.mockResolvedValue({ file });
    runtime.files.lookup.mockResolvedValue({ file });
    runtime.files.search.mockResolvedValue({
      files: [file],
      pagination: { limit: 10, nextCursor: 'next', hasMore: true },
    });
    runtime.files.restoreMany.mockResolvedValue({
      results: [{ fileRef: { id: file.id }, success: true }],
      successCount: 1,
      failureCount: 0,
    });
    const provider = edgestore({ accessKey: 'access', secretKey: 'secret' });
    const source = new Blob(['content'], { type: 'text/plain' });

    await expect(
      provider.backend.upload({
        bucketName: 'files',
        bucketType: 'FILE',
        fileInfo,
        source,
      }),
    ).resolves.toMatchObject({
      file: {
        id: file.id,
        uploadedAt: new Date(file.uploadedAt),
        updatedAt: new Date(file.updatedAt),
      },
    });
    await expect(
      provider.backend.getFile({ file: { key: file.key } }),
    ).resolves.toMatchObject({ id: file.id });
    await expect(
      provider.backend.listFiles({
        bucketName: 'files',
        cursor: 'cursor',
        limit: 10,
      }),
    ).resolves.toMatchObject({
      items: [{ id: file.id }],
      nextCursor: 'next',
    });
    await expect(
      provider.backend.restoreFiles({ files: [{ id: file.id }] }),
    ).resolves.toMatchObject({ successCount: 1 });

    expect(runtime.uploads.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: 'files',
        source,
        metadata: { owner: 'user-1' },
      }),
    );
    expect(runtime.files.lookup).toHaveBeenCalledWith({
      file: { key: file.key },
    });
    expect(runtime.files.search).toHaveBeenCalledWith({
      bucket: 'files',
      filter: undefined,
      pagination: { cursor: 'cursor', limit: 10 },
    });
  });
});
