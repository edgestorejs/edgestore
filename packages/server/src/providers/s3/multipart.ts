import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  type PutObjectCommandInput,
  type S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { type MultipartUploadPlan } from '@edgestore/sdk';
import {
  EdgeStoreError,
  type ProviderMultipartUploads,
} from '@edgestore/shared';
import {
  assertValidParts,
  initialPartNumbers,
  partLength,
  sessionFromPlan,
  type createMultipartSessions,
  type MultipartSession,
} from '../storage/multipartSession';

export function createMultipartUploads({
  client,
  bucket,
  sessions,
  partUrlExpiresIn,
}: {
  client: S3Client;
  bucket: () => string;
  sessions: ReturnType<typeof createMultipartSessions>;
  partUrlExpiresIn: number;
}) {
  async function abort(session: MultipartSession) {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket(),
        Key: session.key,
        UploadId: session.id,
      }),
    );
  }

  async function signParts(session: MultipartSession, parts: number[]) {
    assertValidParts(session, parts);
    return Promise.all(
      parts.map(async (partNumber) => ({
        partNumber,
        uploadUrl: await getSignedUrl(
          client,
          new UploadPartCommand({
            Bucket: bucket(),
            Key: session.key,
            UploadId: session.id,
            PartNumber: partNumber,
            ContentLength: partLength(session, partNumber),
          }),
          { expiresIn: partUrlExpiresIn },
        ),
      })),
    );
  }

  const operations: ProviderMultipartUploads = {
    async requestParts({ uploadId, key, parts }) {
      return {
        parts: await signParts(await sessions.read(uploadId, key), parts),
      };
    },
    async complete({ uploadId, key, parts }) {
      const session = await sessions.read(uploadId, key);
      assertValidParts(
        session,
        parts.map((part) => part.partNumber),
        { complete: true },
      );
      if (parts.some((part) => !part.eTag)) {
        throw new EdgeStoreError({
          code: 'BAD_REQUEST',
          message:
            'S3 multipart parts are missing ETags. Check that the bucket CORS configuration exposes the ETag header.',
        });
      }
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket(),
          Key: key,
          UploadId: session.id,
          MultipartUpload: {
            Parts: [...parts]
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((part) => ({
                PartNumber: part.partNumber,
                ETag: part.eTag,
              })),
          },
        }),
      );
    },
    async abort({ uploadId, key }) {
      await abort(await sessions.read(uploadId, key));
    },
  };

  return {
    operations,
    async request(input: PutObjectCommandInput, plan: MultipartUploadPlan) {
      // Validate signing configuration before allocating storage resources.
      sessions.assertConfigured();
      const { ContentLength, ...objectInput } = input;
      const result = await client.send(
        new CreateMultipartUploadCommand(objectInput),
      );
      if (!result.UploadId || !input.Key || ContentLength === undefined) {
        throw new Error('S3 did not return a multipart upload ID.');
      }
      const session = sessionFromPlan({
        key: input.Key,
        id: result.UploadId,
        size: ContentLength,
        plan,
      });
      try {
        return {
          key: session.key,
          uploadId: await sessions.sign(session),
          partSize: session.partSize,
          totalParts: session.totalParts,
          parts: await signParts(session, initialPartNumbers(plan)),
        };
      } catch (error) {
        await abort(session).catch(() => undefined);
        throw error;
      }
    },
  };
}
