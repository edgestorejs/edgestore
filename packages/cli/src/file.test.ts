import {
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EdgeStoreUploadCleanupError } from '@edgestore/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runCli } from './cli';
import { account, createFixture, project, uploadedFile } from './testFixture';

describe('file', () => {
  let fixture: ReturnType<typeof createFixture>;
  let temporaryDirectory: string | undefined;

  beforeEach(() => {
    fixture = createFixture();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
      temporaryDirectory = undefined;
    }
  });

  it('lists files only within the required bucket', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      ['file', 'list', '--bucket', 'publicFiles'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('file_123');
    expect(fixture.stdout()).toContain('logo.png');
  });

  it('treats URL-shaped references as paths when --bucket is supplied', async () => {
    fixture.lookupFile.mockResolvedValueOnce({
      file: {
        id: 'file_123',
        bucketName: 'publicFiles',
        key: 'https://example.com/logo.png',
        path: {},
        metadata: {},
        sizeBytes: 10,
        mimeType: 'image/png',
        state: 'uploaded',
        temporary: false,
        url: 'https://files.example/logo.png',
        uploadedAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });

    await runCli(
      [
        'file',
        'info',
        'https://example.com/logo.png',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.lookupFile).toHaveBeenCalledWith({
      project: project.basePath,
      file: {
        bucketName: 'publicFiles',
        path: 'https://example.com/logo.png',
      },
      signal: fixture.runtime.signal,
    });
  });

  it('reports completed upload status with the canonical URL', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      ['file', 'upload-status', 'file_123'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('completed');
    expect(fixture.stdout()).toContain('https://files.example/logo.png');
  });

  it('rejects plain upload before inspecting or uploading files', async () => {
    const exitCode = await runCli(
      [
        '--plain',
        'file',
        'upload',
        'missing.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.uploadFile).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--json');
  });

  it('reports completed and unattempted files when a later upload fails', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const paths = ['first.txt', 'second.txt', 'third.txt'];
    await Promise.all(
      paths.map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );
    let requestCount = 0;
    fixture.uploadFile.mockImplementation(async () => {
      requestCount += 1;
      if (requestCount === 2) throw new Error('second upload request failed');
      return {
        upload: { id: 'upload_first', status: 'completed' as const },
        file: {
          ...uploadedFile,
          id: 'upload_first',
          url: 'https://files.example/first.txt',
        },
      };
    });

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'upload',
        ...paths,
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toBe('');
    expect(fixture.uploadFile).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'file_upload_incomplete',
      details: {
        completed: [{ localPath: path.join(temporaryDirectory, 'first.txt') }],
        interruptedPath: path.join(temporaryDirectory, 'second.txt'),
        notAttemptedPaths: [path.join(temporaryDirectory, 'third.txt')],
        cause: { message: 'second upload request failed' },
      },
    });
  });

  it('treats an existing upload path with glob characters literally', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(path.join(temporaryDirectory, 'report[1].txt'), 'literal');
    await writeFile(path.join(temporaryDirectory, 'report1.txt'), 'glob');
    const exitCode = await runCli(
      [
        'file',
        'upload',
        'report[1].txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.uploadFile).toHaveBeenCalledTimes(1);
    const source = fixture.uploadFile.mock.calls[0]?.[0].source;
    expect(source).toBeInstanceOf(Blob);
    expect((source as Blob).size).toBe(7);
  });

  it('rejects same-size source mutations during upload', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const sourcePath = path.join(temporaryDirectory, 'source.txt');
    await writeFile(sourcePath, 'upload me');
    fixture.uploadFile.mockImplementationOnce(async (input) => {
      await writeFile(sourcePath, 'UPLOAD ME');
      await (input.source as Blob).arrayBuffer();
      throw new Error('Expected the file-backed Blob read to fail.');
    });

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'upload',
        'source.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr()).error.code).toBe(
      'upload_source_changed',
    );
  });

  it('reports failed automatic upload cleanup', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(path.join(temporaryDirectory, 'source.txt'), 'upload me');
    fixture.abortController.abort();
    fixture.uploadFile.mockRejectedValueOnce(
      new EdgeStoreUploadCleanupError({
        message: 'Automatic cancellation failed.',
        uploadId: 'upload_123',
        uploadCause: new DOMException('aborted', 'AbortError'),
        cleanupCause: new Error('cleanup unavailable'),
      }),
    );

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'file',
        'upload',
        'source.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'upload_cleanup_failed',
      details: {
        cause: { code: 'interrupted' },
        cleanup: { status: 'failed', uploadId: 'upload_123' },
      },
      suggestions: [
        `edgestore --json --api-url https://api-dev.edgestore.dev file upload-cancel upload_123 --yes --project ${project.basePath}`,
      ],
    });
  });

  it('streams downloads through a restrictive temporary file', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-download-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('first '));
                controller.enqueue(new TextEncoder().encode('second'));
                controller.close();
              },
            }),
          ),
      ),
    );

    const exitCode = await runCli(
      [
        'file',
        'download',
        'file_123',
        '--output',
        'download.txt',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    const outputPath = path.join(temporaryDirectory, 'download.txt');
    expect(exitCode).toBe(0);
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('first second');
    expect((await stat(outputPath)).mode & 0o777).toBe(0o600);
    await expect(readdir(temporaryDirectory)).resolves.toEqual([
      'download.txt',
    ]);
  });

  it('preserves an existing download after a mid-stream failure', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-download-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const outputPath = path.join(temporaryDirectory, 'download.txt');
    await writeFile(outputPath, 'original');
    let pullCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              pull(controller) {
                pullCount += 1;
                if (pullCount === 1) {
                  controller.enqueue(new TextEncoder().encode('partial'));
                } else {
                  controller.error(new Error('stream failed'));
                }
              },
            }),
          ),
      ),
    );

    const exitCode = await runCli(
      [
        'file',
        'download',
        'file_123',
        '--output',
        'download.txt',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('original');
    await expect(readdir(temporaryDirectory)).resolves.toEqual([
      'download.txt',
    ]);
  });

  it('removes a partial download after cancellation', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-download-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const outputPath = path.join(temporaryDirectory, 'download.txt');
    await writeFile(outputPath, 'original');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode('partial'));
                fixture.abortController.abort();
              },
            }),
          ),
      ),
    );

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'download',
        'file_123',
        '--output',
        'download.txt',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(130);
    expect(JSON.parse(fixture.stderr()).error.code).toBe('interrupted');
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('original');
    await expect(readdir(temporaryDirectory)).resolves.toEqual([
      'download.txt',
    ]);
  });

  it('rejects plain file deletion before deleting files', async () => {
    const exitCode = await runCli(
      [
        '--plain',
        'file',
        'delete',
        'file_123',
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.deleteFiles).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('--json');
  });

  it('reports exact partial state when a later delete batch fails', async () => {
    const references = Array.from(
      { length: 201 },
      (_, index) => `file_${index + 1}`,
    );
    let requestCount = 0;
    fixture.deleteFiles.mockImplementation(async (input) => {
      requestCount += 1;
      if (requestCount === 2) throw new Error('second batch failed');
      return {
        results: input.files.map((fileRef) => ({
          fileRef,
          success: true as const,
        })),
        successCount: input.files.length,
        failureCount: 0,
      };
    });

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'delete',
        ...references,
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toBe('');
    expect(fixture.deleteFiles).toHaveBeenCalledTimes(2);
    const details = JSON.parse(fixture.stderr()).error.details;
    expect(details.completed.successCount).toBe(100);
    expect(details.completed.results).toHaveLength(100);
    expect(details.uncertainReferences).toEqual(references.slice(100, 200));
    expect(details.notAttemptedReferences).toEqual(references.slice(200));
    expect(details.cause).toMatchObject({
      code: 'unexpected_error',
      message: 'second batch failed',
    });
  });

  it('identifies per-file deletion failures in human output', async () => {
    fixture.deleteFiles.mockResolvedValueOnce({
      results: [
        { fileRef: { id: 'file_ok' }, success: true },
        {
          fileRef: { id: 'file_failed' },
          success: false,
          error: {
            code: 'FILE_NOT_DELETABLE',
            message: 'File is already deleted.',
          },
        },
      ],
      successCount: 1,
      failureCount: 1,
    });

    const exitCode = await runCli(
      [
        'file',
        'delete',
        'file_ok',
        'file_failed',
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toContain('Deleted 1 file(s); 1 failed.');
    expect(fixture.stdout()).toContain('file_failed: File is already deleted.');
  });
});
