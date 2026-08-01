/* eslint-disable unicorn/filename-case -- The public provider entrypoint is `azure-blob`. */
import {
  BlobSASPermissions,
  BlobServiceClient,
  generateBlobSASQueryParameters,
  SASProtocol,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { type RequestUploadParams } from '@edgestore/shared';
import { z } from 'zod';
import { defineProvider } from '../../core/provider';
import { getEnv } from '../../libs/env';

/**
 * Options for the Azure provider. Compatible with Azure Blob Storage and Azurite.
 * Use Azure Storage Explorer for local development with Azurite.
 * @see https://azure.microsoft.com/de-de/products/storage/storage-explorer
 * @category Providers
 * @example
 *  azureBlob({
 *      storageAccountName: 'devstoreaccount1',
 *      storageAccountKey: 'some-account-key',
 *      containerName: 'some-container-name',
 *      customBaseUrl: 'http://localhost:10000/devstoreaccount1',
 *  })
 */
export type AzureBlobProviderOptions = {
  /**
   * The storage account name for Azure Blob Storage
   * Can also be set via the `ES_AZURE_ACCOUNT_NAME` environment variable.
   */
  storageAccountName?: string;
  /**
   * Account key used to authenticate server-side operations and sign
   * short-lived, blob-scoped URLs.
   * Can also be set via the `ES_AZURE_ACCOUNT_KEY` environment variable.
   */
  storageAccountKey?: string;
  /**
   * Azure Blob Storage container name
   * Can also be set via the `ES_AZURE_CONTAINER_NAME` environment variable.
   */
  containerName?: string;
  /**
   * Optional base URL for the Azure Blob Storage.
   * Useful for local development with Azurite. For example: `http://localhost:10000/devstoreaccount1`
   * Can also be set via the `ES_AZURE_BASE_URL` environment variable.
   */
  customBaseUrl?: string;
  /**
   * Lifetime of generated upload URLs in seconds.
   * @default 3600
   */
  uploadUrlExpiresIn?: number;
  /**
   * Default lifetime of generated private read URLs in seconds.
   * @default 3600
   */
  signedUrlExpiresIn?: number;
};

export function azureBlob(options?: AzureBlobProviderOptions) {
  const {
    storageAccountName = getEnv('ES_AZURE_ACCOUNT_NAME'),
    storageAccountKey = getEnv('ES_AZURE_ACCOUNT_KEY'),
    containerName = getEnv('ES_AZURE_CONTAINER_NAME'),
    customBaseUrl = getEnv('ES_AZURE_BASE_URL'),
    uploadUrlExpiresIn = 60 * 60,
    signedUrlExpiresIn = 60 * 60,
  } = options ?? {};

  if (!storageAccountName) {
    throw new Error(
      'Azure storageAccountName is not configured in AzureBlobProviderOptions.',
    );
  }
  if (!storageAccountKey) {
    throw new Error(
      'Azure storageAccountKey is not configured in AzureBlobProviderOptions.',
    );
  }
  if (!containerName) {
    throw new Error(
      'Azure containerName is not configured in AzureBlobProviderOptions.',
    );
  }
  const resolvedContainerName = containerName;

  const baseUrl =
    customBaseUrl ?? `https://${storageAccountName}.blob.core.windows.net`;
  const sharedKeyCredential = new StorageSharedKeyCredential(
    storageAccountName,
    storageAccountKey,
  );
  const blobServiceClient = new BlobServiceClient(baseUrl, sharedKeyCredential);
  const containerClient = blobServiceClient.getContainerClient(
    resolvedContainerName,
  );

  function createSignedBlobUrl(params: {
    blobName: string;
    permissions: string;
    expiresIn: number;
  }) {
    const expiresAt = new Date(Date.now() + params.expiresIn * 1000);
    const sas = generateBlobSASQueryParameters(
      {
        containerName: resolvedContainerName,
        blobName: params.blobName,
        permissions: BlobSASPermissions.parse(params.permissions),
        protocol: baseUrl.startsWith('https:')
          ? SASProtocol.Https
          : SASProtocol.HttpsAndHttp,
        startsOn: new Date(Date.now() - 5 * 60 * 1000),
        expiresOn: expiresAt,
      },
      sharedKeyCredential,
    ).toString();
    const blobClient = containerClient.getBlobClient(params.blobName);
    return {
      url: blobClient.url.split('?')[0]!,
      signedUrl: `${blobClient.url.split('?')[0]}?${sas}`,
      expiresAt,
      expiresIn: params.expiresIn,
    };
  }

  function getBlobNameFromUrl(url: string) {
    try {
      const blobUrl = new URL(url);
      const containerUrl = new URL(containerClient.url);
      const containerPath = containerUrl.pathname.replace(/\/$/, '');

      if (blobUrl.origin !== containerUrl.origin) {
        throw new Error();
      }

      if (!blobUrl.pathname.startsWith(`${containerPath}/`)) {
        throw new Error();
      }

      return decodeURIComponent(
        blobUrl.pathname.slice(containerPath.length + 1),
      );
    } catch {
      throw new Error('File URL does not belong to this Azure Blob provider.');
    }
  }

  function getBucketBlobName(edgestoreBucketName: string, url: string) {
    const blobName = getBlobNameFromUrl(url);
    if (!blobName.startsWith(`${edgestoreBucketName}/`)) {
      throw new Error(
        `File does not belong to EdgeStore bucket "${edgestoreBucketName}".`,
      );
    }
    return blobName;
  }

  function getBlobName(params: RequestUploadParams) {
    const { bucketName: esBucketName, fileInfo } = params;
    const extension = fileInfo.extension
      ? `.${fileInfo.extension.replace('.', '')}`
      : '';
    const fileName = fileInfo.fileName ?? `${crypto.randomUUID()}${extension}`;

    return [
      esBucketName,
      ...(fileInfo.isPublic ? ['_public'] : []),
      ...fileInfo.path.map((item) => item.value),
      fileName,
    ].join('/');
  }

  return defineProvider({
    name: 'azure-blob',
    baseUrl,
    reference: {
      schema: z.object({ url: z.string() }),
      fromUrl: (url) => ({ url }),
    },
    async init() {
      return {};
    },
    uploads: {
      async request(params) {
        const blobName = getBlobName(params);
        const uploadAccess = createSignedBlobUrl({
          blobName,
          permissions: 'cw',
          expiresIn: uploadUrlExpiresIn,
        });
        const readAccess = params.fileInfo.isPublic
          ? undefined
          : createSignedBlobUrl({
              blobName,
              permissions: 'r',
              expiresIn: signedUrlExpiresIn,
            });
        return {
          uploadUrl: uploadAccess.signedUrl,
          accessUrl: uploadAccess.url,
          accessSignedUrl: readAccess?.signedUrl,
          accessSignedUrlExpiresAt: readAccess?.expiresAt,
          accessSignedUrlExpiresIn: readAccess?.expiresIn,
        };
      },
    },
    files: {
      async get({ bucketName, file }) {
        const blobClient = containerClient.getBlobClient(
          getBucketBlobName(bucketName, file.url),
        );
        const { contentLength, lastModified } =
          await blobClient.getProperties();
        const timestamp = lastModified ?? new Date();
        return {
          url: blobClient.url.split('?')[0]!,
          sizeBytes: contentLength ?? 0,
          uploadedAt: timestamp,
          updatedAt: timestamp,
        };
      },
      async getSignedUrls({ bucketName, files, expiresIn }) {
        return files.map((file) => {
          const access = createSignedBlobUrl({
            blobName: getBucketBlobName(bucketName, file.url),
            permissions: 'r',
            expiresIn: expiresIn ?? signedUrlExpiresIn,
          });
          return {
            url: access.url,
            signedUrl: access.signedUrl,
            expiresAt: access.expiresAt,
            expiresIn: access.expiresIn,
          };
        });
      },
      async delete({ bucketName, files }) {
        const blobNames = files.map((file) =>
          getBucketBlobName(bucketName, file.url),
        );
        const results = await Promise.all(
          blobNames.map(async (blobName) => {
            try {
              const blobClient = containerClient.getBlobClient(blobName);
              await blobClient.delete();
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
          }),
        );
        return { results };
      },
    },
  });
}
