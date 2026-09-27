import {
  mkdir,
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

  it('maps upload destinations and file naming options', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(path.join(temporaryDirectory, 'source.txt'), 'upload me');
    const baseArgs = [
      'file',
      'upload',
      'source.txt',
      '--bucket',
      'publicFiles',
      '--project',
      project.basePath,
    ];

    await runCli(baseArgs, fixture.runtime, '0.0.0');
    await runCli([...baseArgs, '--keep-name'], fixture.runtime, '0.0.0');
    await runCli([...baseArgs, '--path', 'reports/'], fixture.runtime, '0.0.0');
    await runCli(
      [...baseArgs, '--path', 'reports/', '--keep-name'],
      fixture.runtime,
      '0.0.0',
    );
    await runCli(
      [...baseArgs, '--path', 'reports/renamed.txt'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.uploadFile).toHaveBeenCalledTimes(5);
    for (const [input] of fixture.uploadFile.mock.calls) {
      expect(input).not.toHaveProperty('onProgress');
    }
    expect(fixture.uploadFile.mock.calls[0]?.[0]).toMatchObject({
      signedReadUrl: {},
    });
    expect(fixture.uploadFile.mock.calls[0]?.[0]).not.toHaveProperty('path');
    expect(fixture.uploadFile.mock.calls[0]?.[0]).not.toHaveProperty(
      'fileName',
    );
    expect(fixture.uploadFile.mock.calls[1]?.[0]).toMatchObject({
      fileName: 'source.txt',
    });
    expect(fixture.uploadFile.mock.calls[1]?.[0]).not.toHaveProperty('path');
    expect(fixture.uploadFile.mock.calls[2]?.[0]).toMatchObject({
      path: 'reports/',
    });
    expect(fixture.uploadFile.mock.calls[2]?.[0]).not.toHaveProperty(
      'fileName',
    );
    expect(fixture.uploadFile.mock.calls[3]?.[0]).toMatchObject({
      path: 'reports/',
      fileName: 'source.txt',
    });
    expect(fixture.uploadFile.mock.calls[4]?.[0]).toMatchObject({
      path: 'reports',
      fileName: 'renamed.txt',
    });
  });

  it('prints the signed read URL returned for a protected upload', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await writeFile(path.join(temporaryDirectory, 'private.txt'), 'secret');
    fixture.uploadFile.mockResolvedValueOnce({
      upload: { id: 'upload_123', status: 'completed' },
      file: {
        ...uploadedFile,
        id: 'upload_123',
        url: 'https://files.example/private.txt',
      },
      signedReadUrl: {
        url: 'https://files.example/private.txt',
        signedUrl: 'https://files.example/private.txt?signature=test',
        expiresAt: '2026-08-08T12:00:00.000Z',
        expiresIn: 3600,
      },
    });

    await runCli(
      [
        'file',
        'upload',
        'private.txt',
        '--bucket',
        'protectedFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain(
      'https://files.example/private.txt?signature=test',
    );
    expect(fixture.stdout()).not.toContain(
      'private.txt -> https://files.example/private.txt (',
    );
  });

  it('keeps upload paths relative to the invocation directory', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    await writeFile(
      path.join(temporaryDirectory, 'package.json'),
      JSON.stringify({ private: true }),
    );
    await writeFile(
      path.join(temporaryDirectory, 'pnpm-workspace.yaml'),
      "packages:\n  - 'apps/*'\n",
    );
    await writeFile(path.join(temporaryDirectory, 'logo.txt'), 'upload me');
    const appDirectory = path.join(temporaryDirectory, 'apps', 'web');
    await mkdir(path.join(appDirectory, '.edgestore'), { recursive: true });
    await writeFile(
      path.join(appDirectory, 'package.json'),
      JSON.stringify({ name: 'web' }),
    );
    await writeFile(
      path.join(appDirectory, '.edgestore', 'config.json'),
      JSON.stringify({ account: account.id, project: project.basePath }),
    );

    const exitCode = await runCli(
      ['file', 'upload', 'logo.txt', '--bucket', 'publicFiles'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.uploadFile).toHaveBeenCalledOnce();
    expect(fixture.runtime.cwd).toBe(temporaryDirectory);
    expect(fixture.runtime.workspaceCwd).toBe(appDirectory);
  });

  it('rejects --keep-name with an exact upload destination', async () => {
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
        '--path',
        'reports/renamed.txt',
        '--keep-name',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.uploadFile).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'upload_path_keep_name_conflict',
    });
  });

  it('uses one destination folder for every file in a batch', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await Promise.all(
      ['first.txt', 'second.txt'].map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );

    const exitCode = await runCli(
      [
        'file',
        'upload',
        'first.txt',
        'second.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
        '--path',
        'reports/',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.uploadFile).toHaveBeenCalledTimes(2);
    for (const [input] of fixture.uploadFile.mock.calls) {
      expect(input).toMatchObject({ path: 'reports/' });
      expect(input).not.toHaveProperty('fileName');
    }
  });

  it('uploads at most three files concurrently', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const paths = Array.from({ length: 5 }, (_, index) => `file-${index}.txt`);
    await Promise.all(
      paths.map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );
    const releases: (() => void)[] = [];
    let activeUploads = 0;
    let maximumActiveUploads = 0;
    fixture.uploadFile.mockImplementation(async () => {
      activeUploads += 1;
      maximumActiveUploads = Math.max(maximumActiveUploads, activeUploads);
      await new Promise<void>((resolve) => releases.push(resolve));
      activeUploads -= 1;
      return {
        upload: { id: 'upload_completed', status: 'completed' as const },
        file: uploadedFile,
      };
    });

    const command = runCli(
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

    await vi.waitFor(() => expect(fixture.uploadFile).toHaveBeenCalledTimes(3));
    expect(maximumActiveUploads).toBe(3);
    for (const release of releases.splice(0)) release();
    await vi.waitFor(() => expect(fixture.uploadFile).toHaveBeenCalledTimes(5));
    for (const release of releases.splice(0)) release();

    await expect(command).resolves.toBe(0);
    expect(maximumActiveUploads).toBe(3);
    expect(JSON.parse(fixture.stdout()).uploads).toHaveLength(5);
  });

  it('rejects an exact destination for multiple files', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await Promise.all(
      ['first.txt', 'second.txt'].map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'upload',
        'first.txt',
        'second.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
        '--path',
        'reports/report.txt',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.uploadFile).not.toHaveBeenCalled();
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'upload_path_not_folder',
    });
  });

  it('rejects multiple files that resolve to the same destination', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await Promise.all(
      ['first', 'second'].map(async (directory) => {
        const parent = path.join(temporaryDirectory!, directory);
        await mkdir(parent);
        await writeFile(path.join(parent, 'photo.jpg'), directory);
      }),
    );

    const exitCode = await runCli(
      [
        '--json',
        'file',
        'upload',
        'first/photo.jpg',
        'second/photo.jpg',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
        '--path',
        'gallery/',
        '--keep-name',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.uploadFile).not.toHaveBeenCalled();
    const error = JSON.parse(fixture.stderr()).error;
    expect(error).toMatchObject({ code: 'upload_destination_conflict' });
    expect(error.message).toContain('gallery/photo.jpg');
    expect(error.message).toContain('first/photo.jpg');
    expect(error.message).toContain('second/photo.jpg');
  });

  it('reports every completed and failed file after a batch settles', async () => {
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
    fixture.uploadFile.mockImplementation(async (input) => {
      const fileName = await (input.source as Blob).text();
      if (fileName === 'second.txt') {
        throw new Error('second upload request failed');
      }
      return {
        upload: { id: `upload_${fileName}`, status: 'completed' as const },
        file: {
          ...uploadedFile,
          id: `upload_${fileName}`,
          url: `https://files.example/${fileName}`,
        },
        signedReadUrl: {
          url: `https://files.example/${fileName}`,
          signedUrl: `https://files.example/${fileName}?signature=test`,
          expiresAt: '2026-08-08T12:00:00.000Z',
          expiresIn: 3600,
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
    expect(fixture.uploadFile).toHaveBeenCalledTimes(3);
    const error = JSON.parse(fixture.stderr()).error;
    expect(error).toMatchObject({
      code: 'file_upload_incomplete',
      details: {
        completed: [
          { localPath: path.join(temporaryDirectory, 'first.txt') },
          { localPath: path.join(temporaryDirectory, 'third.txt') },
        ],
        failures: [
          {
            localPath: path.join(temporaryDirectory, 'second.txt'),
            cause: { message: 'second upload request failed' },
          },
        ],
        notAttemptedPaths: [],
      },
    });
    expect(error.message).toContain(
      'https://files.example/first.txt?signature=test',
    );
  });

  it('does not schedule more files after a batch is canceled', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    const paths = Array.from({ length: 5 }, (_, index) => `file-${index}.txt`);
    await Promise.all(
      paths.map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );
    fixture.uploadFile.mockImplementation(
      async (input) =>
        await new Promise((_, reject) => {
          input.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
        }),
    );

    const command = runCli(
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

    await vi.waitFor(() => expect(fixture.uploadFile).toHaveBeenCalledTimes(3));
    fixture.abortController.abort();

    await expect(command).resolves.toBe(130);
    expect(fixture.uploadFile).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'file_upload_incomplete',
      details: {
        failures: [{}, {}, {}],
        notAttemptedPaths: [
          path.join(temporaryDirectory, 'file-3.txt'),
          path.join(temporaryDirectory, 'file-4.txt'),
        ],
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

  it('reports cleanup commands for every failed batch upload', async () => {
    temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), 'edgestore-cli-upload-'),
    );
    fixture.runtime.cwd = temporaryDirectory;
    await Promise.all(
      ['first.txt', 'second.txt'].map((file) =>
        writeFile(path.join(temporaryDirectory!, file), file),
      ),
    );
    fixture.uploadFile.mockImplementation(async (input) => {
      const fileName = await (input.source as Blob).text();
      throw new EdgeStoreUploadCleanupError({
        message: 'Automatic cancellation failed.',
        uploadId: `upload_${fileName}`,
        uploadCause: new Error(`${fileName} transfer failed`),
        cleanupCause: new Error('cleanup unavailable'),
      });
    });

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'file',
        'upload',
        'first.txt',
        'second.txt',
        '--bucket',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'file_upload_incomplete',
      suggestions: [
        `edgestore --json --api-url https://api-dev.edgestore.dev file upload-cancel upload_first.txt --yes --project ${project.basePath}`,
        `edgestore --json --api-url https://api-dev.edgestore.dev file upload-cancel upload_second.txt --yes --project ${project.basePath}`,
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
