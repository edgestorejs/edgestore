import { usageError } from '../core/errors';
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
    project: await resolvedProjectRef(runtime, input.project),
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
  const project = await resolvedProjectRef(runtime, input.project);
  let bucket = input.bucket;
  if (!input.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Bucket deletion requires confirmation.',
        [`edgestore bucket delete ${input.bucket} --yes`],
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
