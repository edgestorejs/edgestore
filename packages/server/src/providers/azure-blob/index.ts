/* eslint-disable unicorn/filename-case -- The public provider entrypoint is `azure-blob`. */
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { planMultipartUpload } from '@edgestore/sdk';
import type {
  MaybePromise,
  RequestUploadParams,
  RequestUploadRes,
} from '@edgestore/shared';
import { z } from 'zod';
import { defineProvider } from '../../core/provider';
import { getEnv } from '../../libs/env';
import { createMultipartSessions } from '../storage/multipartSession';
import {
  createObjectKeys,
  type ObjectPathFn,
  type ObjectPathFnArgs,
} from '../storage/objectKeys';
import {
  assertSignedUrlAccessControl,
  runConcurrently,
  signedUrlLifetime,
} from '../storage/transfer';
import {
  createBlockUploads,
  uploadBlob,
  type BlobCommitOptions,
} from './blocks';

/** Blob settings shared by browser and backend uploads. */
export type AzureBlobObjectOptions = {
  cacheControl?: string;
  contentDisposition?: string;
  metadata?: Record<string, string>;
};

export type AzureBlobProviderOptions = {
  /**
   * Storage account name. Can also be set via `ES_AZURE_ACCOUNT_NAME`.
   */
  storageAccountName?: string;
  /**
   * Account key used for server-side operations and for signing short-lived,
   * blob-scoped URLs. Can also be set via `ES_AZURE_ACCOUNT_KEY`.
   */
  storageAccountKey?: string;
  /** Container name. Can also be set via `ES_AZURE_CONTAINER_NAME`. */
  containerName?: string;
  /**
   * Blob service endpoint, for example Azurite at
   * `http://127.0.0.1:10000/devstoreaccount1`. Defaults to
   * `https://<account>.blob.core.windows.net`. Can also be set via
   * `ES_AZURE_ENDPOINT`.
   */
  endpoint?: string;
  /**
   * Base URL for file URLs, such as a CDN in front of the container. Defaults
   * to `<endpoint>/<container>`. Can also be set via `EDGE_STORE_BASE_URL`.
   * Signed URLs always use the endpoint.
   */
  baseUrl?: string;
  /**
   * Secret used to sign multipart upload sessions. Defaults to
   * `EDGE_STORE_JWT_SECRET` or `EDGE_STORE_SECRET_KEY`.
   */
  jwtSecret?: string;
  /**
   * Customizes the blob path beneath the logical EdgeStore bucket prefix.
   * The logical bucket prefix is always preserved.
   */
  path?: ObjectPathFn;
  /** Blob settings shared by browser and backend uploads. */
  objectOptions?:
    | AzureBlobObjectOptions
    | ((args: ObjectPathFnArgs) => MaybePromise<AzureBlobObjectOptions>);
  /** Upload URL lifetime in seconds. Default: 3600. */
  uploadUrlExpiresIn?: number;
  /** Signed read URL lifetime in seconds. Default: 3600. */
  signedUrlExpiresIn?: number;
  /** Automatic multipart upload configuration. */
  multipart?: {
    /** Size above which uploads use blocks. Default: 100 MiB. */
    thresholdBytes?: number;
    /** Preferred block size. Default: 16 MiB; maximum 4000 MiB. */
    partSizeBytes?: number;
    /**
     * How long a browser multipart session can request URLs and complete, in
     * seconds. Default: 86400 (24 hours).
     */
    sessionExpiresIn?: number;
  };
};

const MiB = 1024 ** 2;
/** Largest single Put Blob request. */
const MAX_SINGLE_UPLOAD_BYTES = 5000 * MiB;
/** Largest Put Block request. */
const MAX_BLOCK_BYTES = 4000 * MiB;

const expiration = (value: number) => signedUrlLifetime('Azure Blob', value);

export function azureBlob(options: AzureBlobProviderOptions = {}) {
  const {
    storageAccountName = getEnv('ES_AZURE_ACCOUNT_NAME'),
    storageAccountKey = getEnv('ES_AZURE_ACCOUNT_KEY'),
    containerName = getEnv('ES_AZURE_CONTAINER_NAME'),
  } = options;
  const endpoint = (
    options.endpoint ??
    getEnv('ES_AZURE_ENDPOINT') ??
    `https://${storageAccountName}.blob.core.windows.net`
  ).replace(/\/+$/, '');
  const baseUrl =
    options.baseUrl ??
    getEnv('EDGE_STORE_BASE_URL') ??
    `${endpoint}/${containerName}`;
  const keys = createObjectKeys(baseUrl);
  const uploadExpiresIn = expiration(options.uploadUrlExpiresIn ?? 3600);
  const readExpiresIn = expiration(options.signedUrlExpiresIn ?? 3600);

  function plan(sizeBytes: number) {
    if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0)
      throw new RangeError(
        'Azure Blob upload size must be a nonnegative safe integer.',
      );
    const result = planMultipartUpload({
      sizeBytes,
      thresholdBytes: options.multipart?.thresholdBytes,
      preferredPartSizeBytes: options.multipart?.partSizeBytes,
      forceMultipart: sizeBytes > MAX_SINGLE_UPLOAD_BYTES,
    });
    if (result && result.partSizeBytes > MAX_BLOCK_BYTES)
      throw new RangeError('Azure blocks cannot exceed 4000 MiB.');
    return result;
  }
  // Validate multipart settings even before the first large upload.
  plan(0);

  // Credentials are resolved on first use, so defining a router needs none.
  let resolved:
    | {
        containerName: string;
        credential: StorageSharedKeyCredential;
        container: ReturnType<BlobServiceClient['getContainerClient']>;
      }
    | undefined;
  function storage() {
    if (!storageAccountName || !storageAccountKey || !containerName) {
      throw new Error(
        'Azure Blob requires storageAccountName, storageAccountKey, and containerName (or ES_AZURE_ACCOUNT_NAME, ES_AZURE_ACCOUNT_KEY, and ES_AZURE_CONTAINER_NAME).',
      );
    }
    if (!resolved) {
      const credential = new StorageSharedKeyCredential(
        storageAccountName,
        storageAccountKey,
      );
      resolved = {
        containerName,
        credential,
        container: new BlobServiceClient(
          endpoint,
          credential,
        ).getContainerClient(containerName),
      };
    }
    return resolved;
  }
  const blob = (key: string) => storage().container.getBlockBlobClient(key);

  function sas(key: string, permissions: string, expiresIn: number) {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const { containerName: container, credential } = storage();
    const query = generateBlobSASQueryParameters(
      {
        containerName: container,
        blobName: key,
        permissions: BlobSASPermissions.parse(permissions),
        protocol: endpoint.startsWith('https:')
          ? SASProtocol.Https
          : SASProtocol.HttpsAndHttp,
        // Tolerate clock skew between this server and Azure.
        startsOn: new Date(Date.now() - 5 * 60 * 1000),
        expiresOn: expiresAt,
      },
      credential,
    ).toString();
    return { query, expiresAt };
  }

  function signedRead(key: string, expiresIn = readExpiresIn) {
    const ttl = expiration(expiresIn);
    const { query, expiresAt } = sas(key, 'r', ttl);
    return {
      url: keys.toUrl(key),
      signedUrl: `${blob(key).url}?${query}`,
      expiresAt,
      expiresIn: ttl,
    };
  }

  function readForUpload(key: string, params: RequestUploadParams) {
    if (params.fileInfo.isPublic || !params.autoSignedUrls) return undefined;
    return signedRead(key, params.autoSignedUrls.expiresIn);
  }

  const blocks = createBlockUploads({
    blob,
    sessions: createMultipartSessions({
      providerName: 'Azure Blob',
      audience: `edgestore:azure-blob:${endpoint}:${containerName}`,
      secret: options.jwtSecret,
      expiresIn: options.multipart?.sessionExpiresIn ?? 86400,
    }),
    signPartUrl: (key, id) =>
      `${blob(key).url}?comp=block&blockid=${encodeURIComponent(id)}&${
        sas(key, 'w', uploadExpiresIn).query
      }`,
  });

  async function prepare({ bucketName, fileInfo }: RequestUploadParams) {
    const { key, pathArgs } = await keys.forUpload(
      bucketName,
      fileInfo,
      options.path,
    );
    const objectOptions =
      typeof options.objectOptions === 'function'
        ? await options.objectOptions(pathArgs)
        : options.objectOptions;
    const commit: BlobCommitOptions = {
      blobHTTPHeaders: {
        blobContentType: fileInfo.type || 'application/octet-stream',
        blobCacheControl: objectOptions?.cacheControl,
        blobContentDisposition: objectOptions?.contentDisposition,
      },
      metadata: objectOptions?.metadata,
    };
    return { key, commit, plan: plan(fileInfo.size) };
  }

  return defineProvider({
    name: 'azure-blob',
    baseUrl,
    reference: {
      schema: z.union([
        z.object({ key: z.string().min(1) }),
        z.object({ url: z.string().url() }),
      ]),
      fromUrl: (url) => ({ url }),
    },
    async init({ router }) {
      storage();
      assertSignedUrlAccessControl('Azure Blob', router);
      return {};
    },
    uploads: {
      supportedOptions: { temporary: false, replaceTargetUrl: false },
      async request(params): Promise<RequestUploadRes> {
        const { key, commit, plan } = await prepare(params);
        const read = readForUpload(key, params);
        const access = {
          key,
          accessUrl: keys.toUrl(key),
          ...(read
            ? {
                accessSignedUrl: read.signedUrl,
                accessSignedUrlExpiresAt: read.expiresAt,
                accessSignedUrlExpiresIn: read.expiresIn,
              }
            : {}),
        };
        if (plan) {
          return {
            ...access,
            multipart: await blocks.request({
              key,
              size: params.fileInfo.size,
              plan,
              commit,
            }),
          };
        }
        return {
          ...access,
          uploadUrl: `${blob(key).url}?${sas(key, 'cw', uploadExpiresIn).query}`,
          uploadHeaders: blobUploadHeaders(commit),
        };
      },
      multipart: blocks.operations,
      async upload(params) {
        const { key, commit, plan } = await prepare({
          ...params,
          fileInfo: {
            ...params.fileInfo,
            size: params.source.size,
            type: params.source.type || params.fileInfo.type,
          },
        });
        // Sign before sending bytes: nothing fallible runs after the commit.
        const signedReadUrl = readForUpload(key, params);
        await uploadBlob({
          client: blob(key),
          commit,
          plan,
          source: params.source,
          signal: params.signal,
          onProgress: params.onProgress,
        });
        const uploadedAt = new Date();
        return {
          file: {
            key,
            url: keys.toUrl(key),
            sizeBytes: params.source.size,
            uploadedAt,
            updatedAt: uploadedAt,
          },
          signedReadUrl,
        };
      },
    },
    files: {
      async get({ bucketName, file }) {
        const key = keys.fromReference(bucketName, file);
        const { contentLength, lastModified } = await blob(key).getProperties();
        if (contentLength === undefined || !lastModified)
          throw new Error('File not found');
        return {
          key,
          url: keys.toUrl(key),
          sizeBytes: contentLength,
          uploadedAt: lastModified,
          updatedAt: lastModified,
        };
      },
      async getSignedUrls({ bucketName, files, expiresIn }) {
        return files.map((file) =>
          signedRead(keys.fromReference(bucketName, file), expiresIn),
        );
      },
      async delete({ bucketName, files }) {
        const blobKeys = files.map((file) =>
          keys.fromReference(bucketName, file),
        );
        const results = await runConcurrently(
          blobKeys,
          undefined,
          async (key) => {
            try {
              await blob(key).deleteIfExists();
              return { success: true as const };
            } catch (error) {
              return {
                success: false as const,
                error: {
                  code: 'DELETE_FAILED' as const,
                  message:
                    error instanceof Error ? error.message : 'Delete failed',
                },
              };
            }
          },
        );
        return { results };
      },
    },
  });
}

/** Headers a browser Put Blob request must send to apply the blob settings. */
function blobUploadHeaders({ blobHTTPHeaders, metadata }: BlobCommitOptions) {
  const headers: Record<string, string> = { 'x-ms-blob-type': 'BlockBlob' };
  const fields = {
    blobContentType: 'x-ms-blob-content-type',
    blobCacheControl: 'x-ms-blob-cache-control',
    blobContentDisposition: 'x-ms-blob-content-disposition',
  } as const;
  for (const [field, header] of Object.entries(fields)) {
    const value = blobHTTPHeaders[field as keyof typeof fields];
    if (value !== undefined) headers[header] = value;
  }
  for (const [name, value] of Object.entries(metadata ?? {})) {
    headers[`x-ms-meta-${name}`] = value;
  }
  return headers;
}
