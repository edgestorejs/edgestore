import { beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './cli';
import { account, createFixture, failedEmptyJob, project } from './testFixture';

describe('bucket', () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('creates a bucket in the linked project', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      ['bucket', 'create', 'publicFiles', '--type', 'file', '--public'],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain(
      'Created public file bucket publicFiles.',
    );
  });

  it('rejects a linked project from another API origin', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'list',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error).toMatchObject({
      code: 'project_api_mismatch',
      message: expect.stringContaining(
        'linked project belongs to https://api.edgestore.dev',
      ),
    });
  });

  it('starts an empty-bucket job and prints its status command', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    await runCli(
      [
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'empty',
        'publicFiles',
        '--project',
        project.basePath,
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(fixture.stdout()).toContain('Job: job_123');
    expect(fixture.stdout()).toContain(
      `edgestore --api-url https://api-dev.edgestore.dev bucket empty-status publicFiles --job job_123 --project ${project.basePath}`,
    );
  });

  it('preserves applicable options in confirmation follow-ups', async () => {
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'empty',
        'publicFiles',
        '--project',
        project.basePath,
        '--retry',
        'job_old',
        '--wait',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      `edgestore --json --api-url https://api-dev.edgestore.dev bucket empty publicFiles --retry job_old --wait --yes --project ${project.basePath}`,
    ]);
    expect(fixture.emptyBucket).not.toHaveBeenCalled();
  });

  it('emits one structured error when a waited empty job fails', async () => {
    fixture.getEmptyJob.mockResolvedValueOnce({ job: failedEmptyJob });

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'empty',
        'publicFiles',
        '--project',
        project.basePath,
        '--wait',
        '--yes',
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(fixture.stdout()).toBe('');
    expect(JSON.parse(fixture.stderr())).toEqual({
      error: {
        code: 'bucket_empty_failed',
        message:
          'Bucket empty job job_123 failed after 2/5 files: storage unavailable.',
        details: { job: failedEmptyJob },
        suggestions: [
          `edgestore --json --api-url https://api-dev.edgestore.dev bucket empty publicFiles --retry job_123 --wait --yes --project ${project.basePath}`,
        ],
      },
    });
  });

  it('reports when a bucket has no empty-bucket job', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    const exitCode = await runCli(
      ['--json', 'bucket', 'empty-status', 'publicFiles'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(1);
    expect(JSON.parse(fixture.stderr())).toEqual({
      error: {
        code: 'bucket_empty_job_not_found',
        message: 'No empty-bucket job found for publicFiles.',
        suggestions: [
          `edgestore bucket empty publicFiles --project ${project.basePath}`,
        ],
      },
    });
  });

  it('rejects unsupported bucket types before calling the SDK', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };

    const exitCode = await runCli(
      ['bucket', 'create', 'archives', '--type', 'video', '--protected'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(fixture.createBucket).not.toHaveBeenCalled();
    expect(fixture.stderr()).toContain('file or image');
  });

  it('deletes a bucket with delete-only access when forced', async () => {
    fixture.repoConfig.config = {
      account: account.id,
      project: project.basePath,
    };
    fixture.getBucket.mockRejectedValueOnce(new Error('read denied'));

    const exitCode = await runCli(
      ['bucket', 'delete', 'publicFiles', '--yes'],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(0);
    expect(fixture.deleteBucket).toHaveBeenCalledWith({
      project: project.basePath,
      bucket: 'publicFiles',
      signal: fixture.runtime.signal,
    });
  });

  it('preserves context in non-interactive delete suggestions', async () => {
    fixture.runtime.io.inputIsTty = false;

    const exitCode = await runCli(
      [
        '--json',
        '--api-url',
        'https://api-dev.edgestore.dev',
        'bucket',
        'delete',
        'publicFiles',
        '--project',
        project.basePath,
      ],
      fixture.runtime,
      '0.0.0',
    );

    expect(exitCode).toBe(2);
    expect(JSON.parse(fixture.stderr()).error.suggestions).toEqual([
      `edgestore --json --api-url https://api-dev.edgestore.dev bucket delete publicFiles --yes --project ${project.basePath}`,
    ]);
    expect(fixture.deleteBucket).not.toHaveBeenCalled();
  });
});
