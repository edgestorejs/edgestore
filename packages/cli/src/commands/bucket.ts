import { renderCliCommand } from '../core/command';
import { CliError, usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { isInteractive, outputFor, sdkFor } from '../core/runtime';
import { resolvedProjectRef } from './project';

export async function bucketListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  project?: string,
): Promise<void> {
  const projectRef = await resolvedProjectRef(runtime, flags, project);
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.buckets.list({
    project: projectRef,
    signal: runtime.signal,
  });
  const rows = result.buckets.map((bucket) => [
    bucket.name,
    bucket.type,
    bucket.visibility,
    bucket.usageBytes,
    bucket.id,
  ]);
  outputFor(runtime, flags).result(
    result,
    rows.length
      ? renderTable(['NAME', 'TYPE', 'VISIBILITY', 'BYTES', 'ID'], rows)
      : 'No buckets found.',
  );
}

export async function bucketShowCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string },
): Promise<void> {
  const result = await getBucket(runtime, flags, input);
  outputFor(runtime, flags).result(
    result,
    [
      `Name: ${result.bucket.name}`,
      `Type: ${result.bucket.type}`,
      `Visibility: ${result.bucket.visibility}`,
      `Usage: ${result.bucket.usageBytes} bytes`,
      `ID: ${result.bucket.id}`,
    ].join('\n'),
    result.bucket.name,
  );
}

export async function bucketCreateCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    bucket: string;
    project?: string;
    type: string;
    public?: boolean;
    protected?: boolean;
  },
): Promise<void> {
  validateBucketName(input.bucket);
  const type = parseBucketType(input.type);
  if (Boolean(input.public) === Boolean(input.protected)) {
    throw usageError(
      'bucket_visibility_required',
      'Choose exactly one of --public or --protected.',
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.buckets.create({
    project: await resolvedProjectRef(runtime, flags, input.project),
    name: input.bucket,
    type,
    visibility: input.public ? 'public' : 'protected',
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Created ${result.bucket.visibility} ${result.bucket.type} bucket ${result.bucket.name}.`,
    result.bucket.name,
  );
}

export function parseBucketType(value: string | undefined): 'file' | 'image' {
  if (value === 'file' || value === 'image') return value;
  throw usageError('invalid_bucket_type', 'Bucket type must be file or image.');
}

export async function bucketDeleteCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string; yes?: boolean },
): Promise<void> {
  validateBucketName(input.bucket);
  const project = await resolvedProjectRef(runtime, flags, input.project);
  let bucket = input.bucket;
  if (!input.yes) {
    if (!isInteractive(runtime, flags)) {
      throw usageError(
        'confirmation_required',
        'Bucket deletion requires confirmation.',
        [
          renderCliCommand(flags, ['bucket', 'delete', input.bucket, '--yes'], {
            project,
          }),
        ],
      );
    }
    const current = await getBucket(runtime, flags, {
      project,
      bucket: input.bucket,
    });
    bucket = current.bucket.name;
    await runtime.prompts.confirmTyped(
      `Type ${bucket} to delete this bucket`,
      bucket,
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.buckets.delete({
    project,
    bucket,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(result, `Deleted bucket ${bucket}.`, bucket);
}

export async function bucketEmptyCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    bucket: string;
    project?: string;
    retry?: string;
    wait?: boolean;
    yes?: boolean;
  },
): Promise<void> {
  const project = await resolvedProjectRef(runtime, flags, input.project);
  if (!input.yes) {
    if (!isInteractive(runtime, flags)) {
      throw usageError(
        'confirmation_required',
        'Emptying a bucket requires confirmation.',
        [
          renderCliCommand(
            flags,
            [
              'bucket',
              'empty',
              input.bucket,
              ...(input.retry ? ['--retry', input.retry] : []),
              ...(input.wait ? ['--wait'] : []),
              '--yes',
            ],
            { project },
          ),
        ],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type ${input.bucket} to asynchronously delete all files`,
      input.bucket,
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const started = input.retry
    ? await sdk.management.buckets.emptyJobs.retry({
        project,
        bucket: input.bucket,
        jobId: input.retry,
        signal: runtime.signal,
      })
    : await sdk.management.buckets.empty({
        project,
        bucket: input.bucket,
        signal: runtime.signal,
      });
  if (input.wait) {
    const job = await waitForEmptyJob(runtime, flags, {
      project,
      bucket: input.bucket,
      jobId: started.jobId,
    });
    if (job.status === 'FAILED') {
      throw new CliError(
        'bucket_empty_failed',
        `Bucket empty job ${job.id} failed after ${job.processedCount}/${job.totalCount} files: ${job.error ?? 'unknown failure'}.`,
        {
          details: { job },
          suggestions: [
            renderCliCommand(
              flags,
              [
                'bucket',
                'empty',
                input.bucket,
                '--retry',
                job.id,
                '--wait',
                ...(input.yes ? ['--yes'] : []),
              ],
              { project },
            ),
          ],
        },
      );
    }
    renderEmptyJob(runtime, flags, job);
    return;
  }
  outputFor(runtime, flags).result(
    started,
    [
      'Started empty bucket job.',
      `Job: ${started.jobId}`,
      '',
      'Check status:',
      `  ${renderCliCommand(
        flags,
        ['bucket', 'empty-status', input.bucket, '--job', started.jobId],
        { project },
      )}`,
    ].join('\n'),
    started.jobId,
  );
}

export async function bucketEmptyStatusCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string; job?: string },
): Promise<void> {
  const project = await resolvedProjectRef(runtime, flags, input.project);
  const sdk = await sdkFor(runtime, flags);
  const result = input.job
    ? await sdk.management.buckets.emptyJobs.get({
        project,
        bucket: input.bucket,
        jobId: input.job,
        signal: runtime.signal,
      })
    : await sdk.management.buckets.emptyJobs.latest({
        project,
        bucket: input.bucket,
        signal: runtime.signal,
      });
  if (!result.job) {
    throw new CliError(
      'bucket_empty_job_not_found',
      `No empty-bucket job found for ${input.bucket}.`,
      {
        suggestions: [
          renderCliCommand(flags, ['bucket', 'empty', input.bucket], {
            project,
            preserveOutputMode: false,
          }),
        ],
      },
    );
  }
  renderEmptyJob(runtime, flags, result.job);
}

async function getBucket(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string },
) {
  const sdk = await sdkFor(runtime, flags);
  return sdk.management.buckets.get({
    project: await resolvedProjectRef(runtime, flags, input.project),
    bucket: input.bucket,
    signal: runtime.signal,
  });
}

function validateBucketName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/.test(name)) {
    throw usageError(
      'invalid_bucket_name',
      'Bucket names must begin with a letter or number and contain only letters, numbers, underscores, or hyphens.',
    );
  }
}

type EmptyJob = Awaited<
  ReturnType<
    Awaited<
      ReturnType<typeof sdkFor>
    >['management']['buckets']['emptyJobs']['get']
  >
>['job'];

async function waitForEmptyJob(
  runtime: CliRuntime,
  flags: GlobalFlags,
  target: { project: string; bucket: string; jobId: string },
): Promise<EmptyJob> {
  const sdk = await sdkFor(runtime, flags);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await sdk.management.buckets.emptyJobs.get({
      project: target.project,
      bucket: target.bucket,
      jobId: target.jobId,
      signal: runtime.signal,
    });
    if (result.job.status === 'SUCCEEDED' || result.job.status === 'FAILED') {
      return result.job;
    }
    await delay(Math.min(1_000 + attempt * 250, 5_000), runtime.signal);
  }
  throw new CliError(
    'bucket_empty_timeout',
    'Timed out waiting for the bucket empty job.',
    {
      details: { jobId: target.jobId },
      suggestions: [
        renderCliCommand(
          flags,
          ['bucket', 'empty-status', target.bucket, '--job', target.jobId],
          { project: target.project },
        ),
      ],
    },
  );
}

function renderEmptyJob(
  runtime: CliRuntime,
  flags: GlobalFlags,
  job: EmptyJob,
): void {
  outputFor(runtime, flags).result(
    { job },
    [
      `Job: ${job.id}`,
      `Status: ${job.status.toLowerCase()}`,
      `Phase: ${job.phase.toLowerCase()}`,
      `Progress: ${job.processedCount}/${job.totalCount}`,
      `Freed: ${job.freedBytes} bytes`,
      `Canceled uploads: ${job.canceledUploadCount}`,
      `Orphan objects: ${job.orphanObjectCount}`,
      ...(job.error ? [`Failure: ${job.error}`] : []),
    ].join('\n'),
    job.status.toLowerCase(),
  );
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(
          new CliError('interrupted', 'Operation canceled.', { exitCode: 130 }),
        );
      },
      { once: true },
    );
  });
}
