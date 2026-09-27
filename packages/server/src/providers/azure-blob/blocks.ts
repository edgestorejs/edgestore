/* eslint-disable unicorn/filename-case -- Lives in the public `azure-blob` provider directory. */
import type {
  BlobHTTPHeaders,
  BlockBlobClient,
  Metadata,
} from '@azure/storage-blob';
import { type MultipartUploadPlan } from '@edgestore/sdk';
import {
  EdgeStoreError,
  type BackendUploadParams,
  type ProviderMultipartUploads,
} from '@edgestore/shared';
import { z } from 'zod';
import {
  assertValidParts,
  initialPartNumbers,
  partLength,
  sessionFromPlan,
  type createMultipartSessions,
  type MultipartSession,
} from '../storage/multipartSession';
import { createProgress, readPart, runConcurrently } from '../storage/transfer';

const commitSchema = z.object({
  blobHTTPHeaders: z.object({
    blobContentType: z.string().optional(),
    blobCacheControl: z.string().optional(),
    blobContentDisposition: z.string().optional(),
  }),
  metadata: z.record(z.string()).optional(),
});

/** Blob properties applied when the blob is committed. */
export type BlobCommitOptions = {
  blobHTTPHeaders: Pick<
    BlobHTTPHeaders,
    'blobContentType' | 'blobCacheControl' | 'blobContentDisposition'
  >;
  metadata?: Metadata;
};

/**
 * Block IDs must be base64 strings of equal length within a blob. The session
 * prefix keeps concurrent uploads to the same blob name from sharing blocks.
 */
export function blockId(prefix: string, partNumber: number) {
  return btoa(`${prefix}-${String(partNumber).padStart(5, '0')}`);
}

function newBlockPrefix() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

function allBlockIds(session: MultipartSession) {
  return Array.from({ length: session.totalParts }, (_, index) =>
    blockId(session.id, index + 1),
  );
}

/**
 * Browser multipart uploads stage blocks with Put Block URLs and commit them
 * with Put Block List. Azure has no upload session to cancel: uncommitted
 * blocks are discarded automatically after seven days.
 */
export function createBlockUploads({
  blob,
  sessions,
  signPartUrl,
}: {
  blob: (key: string) => BlockBlobClient;
  sessions: ReturnType<typeof createMultipartSessions>;
  signPartUrl: (key: string, blockId: string) => string;
}) {
  function signParts(session: MultipartSession, parts: number[]) {
    assertValidParts(session, parts);
    return parts.map((partNumber) => ({
      partNumber,
      uploadUrl: signPartUrl(session.key, blockId(session.id, partNumber)),
    }));
  }

  /** SAS URLs cannot limit sizes, so check every staged block before committing. */
  async function assertStagedBlocks(session: MultipartSession) {
    const { uncommittedBlocks = [] } = await blob(session.key).getBlockList(
      'uncommitted',
    );
    const sizes = new Map(
      uncommittedBlocks.map((block) => [block.name, block.size]),
    );
    for (let partNumber = 1; partNumber <= session.totalParts; partNumber++) {
      if (
        sizes.get(blockId(session.id, partNumber)) !==
        partLength(session, partNumber)
      ) {
        throw new EdgeStoreError({
          code: 'BAD_REQUEST',
          message: `Azure block for part ${partNumber} is missing or has the wrong size.`,
        });
      }
    }
  }

  const operations: ProviderMultipartUploads = {
    async requestParts({ uploadId, key, parts }) {
      return { parts: signParts(await sessions.read(uploadId, key), parts) };
    },
    async complete({ uploadId, key, parts }) {
      const session = await sessions.read(uploadId, key);
      assertValidParts(
        session,
        parts.map((part) => part.partNumber),
        { complete: true },
      );
      await assertStagedBlocks(session);
      await blob(key).commitBlockList(
        allBlockIds(session),
        commitSchema.parse(session.data),
      );
    },
    async abort({ uploadId, key }) {
      await sessions.read(uploadId, key);
    },
  };

  return {
    operations,
    async request({
      key,
      size,
      plan,
      commit,
    }: {
      key: string;
      size: number;
      plan: MultipartUploadPlan;
      commit: BlobCommitOptions;
    }) {
      const session = sessionFromPlan({
        key,
        id: newBlockPrefix(),
        size,
        plan,
        data: commit,
      });
      return {
        key,
        uploadId: await sessions.sign(session),
        partSize: session.partSize,
        totalParts: session.totalParts,
        parts: signParts(session, initialPartNumbers(plan)),
      };
    },
  };
}

/** Uploads from the server with the SDK client, which owns request retries. */
export async function uploadBlob({
  client,
  commit,
  plan,
  source,
  signal,
  onProgress,
}: {
  client: BlockBlobClient;
  commit: BlobCommitOptions;
  plan: MultipartUploadPlan | null;
} & Pick<BackendUploadParams, 'source' | 'signal' | 'onProgress'>) {
  signal?.throwIfAborted();
  const progress = createProgress(source.size, onProgress);
  if (!plan) {
    const body = new Uint8Array(await source.arrayBuffer());
    await client.upload(body, body.byteLength, {
      ...commit,
      abortSignal: signal,
    });
    progress(body.byteLength);
    return;
  }

  const prefix = newBlockPrefix();
  const ids = await runConcurrently(
    plan.partNumbers,
    signal,
    async (partNumber, partSignal) => {
      const body = await readPart(source, partNumber, plan.partSizeBytes);
      const id = blockId(prefix, partNumber);
      await client.stageBlock(id, body, body.byteLength, {
        abortSignal: partSignal,
      });
      progress(body.byteLength);
      return id;
    },
  );
  // Uncommitted blocks from a failed upload expire on their own.
  await client.commitBlockList(ids, { ...commit, abortSignal: signal });
}
