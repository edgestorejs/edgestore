import { type MultipartUploadPlan } from '@edgestore/sdk';
import { EdgeStoreError } from '@edgestore/shared';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { INITIAL_MULTIPART_PART_URLS } from '../../core/provider';
import { getEnv } from '../../libs/env';

const sessionSchema = z.object({
  key: z.string(),
  /** Storage upload ID (S3) or block ID prefix (Azure). */
  id: z.string(),
  size: z.number().int().nonnegative(),
  partSize: z.number().int().positive(),
  totalParts: z.number().int().min(1).max(10_000),
  /** Provider-specific settings applied when the upload completes. */
  data: z.record(z.unknown()).optional(),
});

export type MultipartSession = z.infer<typeof sessionSchema>;

/**
 * Browser multipart sessions are HS256 JWTs. The token is the `uploadId` the
 * browser sends back, and acts as a bearer capability for one object key.
 */
export function createMultipartSessions({
  providerName,
  audience,
  secret,
  expiresIn,
}: {
  providerName: string;
  audience: string;
  secret: string | undefined;
  expiresIn: number;
}) {
  if (!Number.isSafeInteger(expiresIn) || expiresIn < 1) {
    throw new RangeError(
      `${providerName} multipart session lifetime must be a positive integer number of seconds.`,
    );
  }

  function signingKey() {
    const value =
      secret ??
      getEnv('EDGE_STORE_JWT_SECRET') ??
      getEnv('EDGE_STORE_SECRET_KEY');
    if (!value)
      throw new Error(
        `${providerName} multipart uploads require jwtSecret or EDGE_STORE_JWT_SECRET.`,
      );
    return new TextEncoder().encode(value);
  }

  return {
    /** Fails before storage resources are allocated when no secret is set. */
    assertConfigured() {
      signingKey();
    },

    sign(session: MultipartSession) {
      return new SignJWT(session)
        .setProtectedHeader({ alg: 'HS256' })
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(`${expiresIn}s`)
        .sign(signingKey());
    },

    async read(token: string, key: string) {
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
          message: `Invalid or expired ${providerName} multipart upload session.`,
        });
      }
    },
  };
}

/** Builds a session from an upload plan. */
export function sessionFromPlan(
  key: string,
  id: string,
  size: number,
  plan: MultipartUploadPlan,
  data?: Record<string, unknown>,
): MultipartSession {
  return {
    key,
    id,
    size,
    partSize: plan.partSizeBytes,
    totalParts: plan.totalParts,
    ...(data ? { data } : {}),
  };
}

/** Part numbers whose URLs are signed when the upload starts. */
export function initialPartNumbers(plan: MultipartUploadPlan) {
  return plan.partNumbers.slice(0, INITIAL_MULTIPART_PART_URLS);
}

/** Rejects empty, duplicate, or out-of-range part lists. */
export function assertValidParts(
  session: MultipartSession,
  parts: number[],
  { complete = false } = {},
) {
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
      message: 'Invalid multipart part numbers.',
    });
  }
}

/** Byte length of one part; the last part may be shorter. */
export function partLength(session: MultipartSession, partNumber: number) {
  return Math.min(
    session.partSize,
    session.size - (partNumber - 1) * session.partSize,
  );
}
