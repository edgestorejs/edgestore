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
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

const sessionSchema = z.object({
  key: z.string(),
  uploadId: z.string(),
  size: z.number().int().nonnegative(),
  partSize: z.number().int().positive(),
  totalParts: z.number().int().min(1).max(10_000),
});
type Session = z.infer<typeof sessionSchema>;

/** The signed upload ID is a bearer capability scoped to one authorized object. */
export function createMultipartUploads({
  client,
  bucket,
  audience,
  secret,
  expiresIn,
}: {
  client: S3Client;
  bucket: () => string;
  audience: string;
  secret: () => string | undefined;
  expiresIn: number;
}) {
  function signingKey() {
    const value = secret();
    if (!value)
      throw new Error(
        'S3 multipart uploads require jwtSecret or EDGE_STORE_JWT_SECRET.',
      );
    return new TextEncoder().encode(value);
  }

  async function readSession(token: string, key: string) {
    try {
      const { payload } = await jwtVerify(token, signingKey(), {
        algorithms: ['HS256'],
        audience,
      });
      const session = sessionSchema.parse(payload);
      if (session.key !== key) throw new Error('Wrong object key');
      return session;
    } catch {
      throw new EdgeStoreError({
        code: 'BAD_REQUEST',
        message: 'Invalid or expired S3 multipart upload session.',
      });
    }
  }

  function validateParts(session: Session, parts: number[], complete = false) {
    if (
      !parts.length ||
      new Set(parts).size !== parts.length ||
      parts.some(
        (part) =>
          !Number.isInteger(part) || part < 1 || part > session.totalParts,
      ) ||
      (complete && parts.length !== session.totalParts)
    ) {
      throw new EdgeStoreError({
        code: 'BAD_REQUEST',
        message: 'Invalid S3 multipart part numbers.',
      });
    }
  }

  async function abort(session: Session) {
    await client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket(),
        Key: session.key,
        UploadId: session.uploadId,
      }),
    );
  }

  async function signParts(session: Session, parts: number[]) {
    validateParts(session, parts);
    return Promise.all(
      parts.map(async (partNumber) => ({
        partNumber,
        uploadUrl: await getSignedUrl(
          client,
          new UploadPartCommand({
            Bucket: bucket(),
            Key: session.key,
            UploadId: session.uploadId,
            PartNumber: partNumber,
            ContentLength: Math.min(
              session.partSize,
              session.size - (partNumber - 1) * session.partSize,
            ),
          }),
          { expiresIn },
        ),
      })),
    );
  }

  const operations: ProviderMultipartUploads = {
    async requestParts({ multipart, path }) {
      const session = await readSession(multipart.uploadId, path);
      return {
        multipart: {
          uploadId: multipart.uploadId,
          parts: await signParts(session, multipart.parts),
        },
      };
    },
    async complete({ uploadId, key, parts }) {
      const session = await readSession(uploadId, key);
      validateParts(
        session,
        parts.map((part) => part.partNumber),
        true,
      );
      if (parts.some((part) => !part.eTag.trim())) {
        throw new EdgeStoreError({
          code: 'BAD_REQUEST',
          message: 'Missing S3 multipart ETag.',
        });
      }
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket(),
          Key: key,
          UploadId: session.uploadId,
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
      await abort(await readSession(uploadId, key));
    },
  };

  return {
    operations,
    async request(input: PutObjectCommandInput, plan: MultipartUploadPlan) {
      // Validate signing configuration before allocating storage resources.
      const key = signingKey();
      const { ContentLength, ...objectInput } = input;
      const result = await client.send(
        new CreateMultipartUploadCommand(objectInput),
      );
      if (!result.UploadId || !input.Key || ContentLength === undefined) {
        throw new Error('S3 did not return a multipart upload ID.');
      }
      const session: Session = {
        key: input.Key,
        uploadId: result.UploadId,
        size: ContentLength,
        partSize: plan.partSizeBytes,
        totalParts: plan.totalParts,
      };
      try {
        const uploadId = await new SignJWT(session)
          .setProtectedHeader({ alg: 'HS256' })
          .setAudience(audience)
          .setIssuedAt()
          .setExpirationTime('24h')
          .sign(key);
        return {
          key: session.key,
          uploadId,
          partSize: session.partSize,
          totalParts: session.totalParts,
          parts: await signParts(session, plan.partNumbers),
          abortSupported: true,
        };
      } catch (error) {
        await abort(session).catch(() => undefined);
        throw error;
      }
    },
  };
}
