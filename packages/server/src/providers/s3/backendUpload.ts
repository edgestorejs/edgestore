import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
  type PutObjectCommandInput,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { MultipartUploadPlan } from '@edgestore/sdk';
import type { BackendUploadParams } from '@edgestore/shared';

/** Upload one bounded chunk at a time; the AWS client owns request retries. */
export async function uploadObject({
  client,
  input,
  source,
  plan,
  signal,
  onProgress,
}: {
  client: S3Client;
  input: PutObjectCommandInput;
  plan: MultipartUploadPlan | null;
} & Pick<BackendUploadParams, 'source' | 'signal' | 'onProgress'>) {
  signal?.throwIfAborted();
  const progress = (transferredBytes: number) =>
    onProgress?.({
      transferredBytes,
      totalBytes: source.size,
      percentage: source.size ? (transferredBytes / source.size) * 100 : 100,
      phase: 'uploading',
    });
  progress(0);
  if (!plan) {
    await client.send(
      new PutObjectCommand({
        ...input,
        Body: new Uint8Array(await source.arrayBuffer()),
      }),
      { abortSignal: signal },
    );
    progress(source.size);
    return;
  }
  const { ContentLength: _length, ...objectInput } = input;
  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand(objectInput),
    { abortSignal: signal },
  );
  if (!UploadId) throw new Error('S3 did not return a multipart upload ID.');
  const session = { Bucket: input.Bucket, Key: input.Key, UploadId };
  try {
    const parts = [];
    for (const partNumber of plan.partNumbers) {
      signal?.throwIfAborted();
      const start = (partNumber - 1) * plan.partSizeBytes;
      const body = new Uint8Array(
        await source.slice(start, start + plan.partSizeBytes).arrayBuffer(),
      );
      const { ETag } = await client.send(
        new UploadPartCommand({
          ...session,
          PartNumber: partNumber,
          Body: body,
        }),
        { abortSignal: signal },
      );
      if (!ETag) throw new Error('Missing S3 multipart ETag.');
      parts.push({ PartNumber: partNumber, ETag });
      progress(Math.min(source.size, start + body.byteLength));
    }
    await client.send(
      new CompleteMultipartUploadCommand({
        ...session,
        MultipartUpload: { Parts: parts },
      }),
      { abortSignal: signal },
    );
  } catch (error) {
    // Do not use the aborted signal for cleanup. Lifecycle rules cover cleanup failures.
    await client
      .send(new AbortMultipartUploadCommand(session))
      .catch(() => undefined);
    throw error;
  }
}
