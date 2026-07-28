import { CliError, usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import { resolvedProjectRef } from './project';

export async function bucketListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  project?: string,
): Promise<void> {
  const projectRef = await resolvedProjectRef(runtime, project);
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
    type: 'file' | 'image';
    public?: boolean;
    protected?: boolean;
  },
): Promise<void> {
  validateBucketName(input.bucket);
  if (Boolean(input.public) === Boolean(input.protected)) {
    throw usageError(
      'bucket_visibility_required',
      'Choose exactly one of --public or --protected.',
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.buckets.create({
    project: await resolvedProjectRef(runtime, input.project),
    name: input.bucket,
    type: input.type,
    visibility: input.public ? 'public' : 'protected',
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Created ${result.bucket.visibility} ${result.bucket.type} bucket ${result.bucket.name}.`,
    result.bucket.name,
  );
}

export async function bucketDeleteCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string; yes?: boolean },
): Promise<void> {
  const project = await resolvedProjectRef(runtime, input.project);
  const current = await getBucket(runtime, flags, {
    project,
    bucket: input.bucket,
  });
  if (!input.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Bucket deletion requires confirmation.',
        [`edgestore bucket delete ${input.bucket} --yes`],
      );
    }
    await runtime.prompts.confirmTyped(
      `Type ${current.bucket.name} to delete this bucket`,
      current.bucket.name,
    );
  }
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.buckets.delete({
    project,
    bucket: current.bucket.name,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    result,
    `Deleted bucket ${current.bucket.name}.`,
    current.bucket.name,
  );
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
  const project = await resolvedProjectRef(runtime, input.project);
  if (!input.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Emptying a bucket requires confirmation.',
        [`edgestore bucket empty ${input.bucket} --yes`],
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
    renderEmptyJob(runtime, flags, job);
    if (job.status === 'FAILED') {
      throw new CliError(
        'bucket_empty_failed',
        'The bucket empty job failed.',
        {
          details: { jobId: job.id, error: job.error },
          suggestions: [
            `edgestore bucket empty ${input.bucket} --retry ${job.id}`,
          ],
        },
      );
    }
    return;
  }
  outputFor(runtime, flags).result(
    started,
    [
      'Started empty bucket job.',
      `Job: ${started.jobId}`,
      '',
      'Check status:',
      `  edgestore bucket empty-status ${input.bucket} --job ${started.jobId}`,
    ].join('\n'),
    started.jobId,
  );
}

export async function bucketEmptyStatusCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string; job?: string },
): Promise<void> {
  const project = await resolvedProjectRef(runtime, input.project);
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
  renderEmptyJob(runtime, flags, result.job);
}

async function getBucket(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { bucket: string; project?: string },
) {
  const sdk = await sdkFor(runtime, flags);
  return sdk.management.buckets.get({
    project: await resolvedProjectRef(runtime, input.project),
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
        `edgestore bucket empty-status ${target.bucket} --job ${target.jobId}`,
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
