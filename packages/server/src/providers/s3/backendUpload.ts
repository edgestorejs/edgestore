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
import { createProgress, readPart, runConcurrently } from '../storage/transfer';

/** Uploads with the configured S3 client, which owns request retries. */
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
  const progress = createProgress(source.size, onProgress);
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
    const parts = await runConcurrently(
      plan.partNumbers,
      signal,
      async (partNumber, partSignal) => {
        const body = await readPart(source, partNumber, plan.partSizeBytes);
        const { ETag } = await client.send(
          new UploadPartCommand({
            ...session,
            PartNumber: partNumber,
            Body: body,
          }),
          { abortSignal: partSignal },
        );
        if (!ETag) throw new Error('Missing S3 multipart ETag.');
        progress(body.byteLength);
        return { PartNumber: partNumber, ETag };
      },
    );
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
