import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  PutObjectCommand,
  UploadPartCommand,
  type PutObjectCommandInput,
  type S3Client,
} from '@aws-sdk/client-s3';
import {
  DEFAULT_MULTIPART_CONCURRENCY,
  type MultipartUploadPlan,
} from '@edgestore/sdk';
import type { BackendUploadParams } from '@edgestore/shared';

/**
 * Uploads with the configured S3 client, which owns request retries. Multipart
 * parts are read and sent a few at a time to bound memory use.
 */
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
  let transferredBytes = 0;
  const progress = (bytes: number) => {
    transferredBytes += bytes;
    onProgress?.({
      transferredBytes,
      totalBytes: source.size,
      percentage: source.size ? (transferredBytes / source.size) * 100 : 100,
      phase: 'uploading',
    });
  };
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
  const controller = new AbortController();
  const partSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  const uploadPart = async (partNumber: number) => {
    const start = (partNumber - 1) * plan.partSizeBytes;
    const body = new Uint8Array(
      await source.slice(start, start + plan.partSizeBytes).arrayBuffer(),
    );
    const { ETag } = await client.send(
      new UploadPartCommand({ ...session, PartNumber: partNumber, Body: body }),
      { abortSignal: partSignal },
    );
    if (!ETag) throw new Error('Missing S3 multipart ETag.');
    progress(body.byteLength);
    return { PartNumber: partNumber, ETag };
  };

  try {
    const parts = new Array<{ PartNumber: number; ETag: string }>();
    let next = 0;
    const workers = Array.from(
      { length: Math.min(DEFAULT_MULTIPART_CONCURRENCY, plan.totalParts) },
      async () => {
        while (next < plan.partNumbers.length) {
          partSignal.throwIfAborted();
          const index = next++;
          parts[index] = await uploadPart(plan.partNumbers[index]!);
        }
      },
    );
    try {
      await Promise.all(workers);
    } catch (error) {
      controller.abort(error);
      await Promise.allSettled(workers);
      throw error;
    }
    signal?.throwIfAborted();
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
    throw signal?.aborted ? signal.reason : error;
  }
}
