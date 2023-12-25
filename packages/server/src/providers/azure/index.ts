import { BlobServiceClient } from '@azure/storage-blob';
import { type Provider } from '@edgestore/shared';
import { v4 as uuidv4 } from 'uuid';

export type AzureProviderOptions = {
  /**
   * The storage account name for Azure Blob Storage
   * Can also be set via the `ES_AZURE_ACCOUNT_NAME` environment variable.
   */
  storageAccountName?: string;
  /**
   * SAS token for Azure Blob Storage
   * Can also be set via the `ES_AZURE_SAS_TOKEN` environment variable.
   */
  sasToken?: string;
  /**
   * Azure Blob Storage container name
   * Can also be set via the `ES_AZURE_CONTAINER_NAME` environment variable.
   */
  containerName?: string;
};

export function AzureProvider(options?: AzureProviderOptions): Provider {
  const {
    storageAccountName = process.env.ES_AZURE_ACCOUNT_NAME,
    sasToken = process.env.ES_AZURE_SAS_TOKEN,
    containerName = process.env.ES_AZURE_CONTAINER_NAME,
  } = options ?? {};

  const baseUrl = `https://${storageAccountName}.blob.core.windows.net`;
  const blobServiceClient = new BlobServiceClient(`${baseUrl}?${sasToken}`);
  const containerClient = blobServiceClient.getContainerClient(
    containerName ?? '',
  );

  return {
    async init() {
      return {};
    },
    getBaseUrl() {
      return baseUrl;
    },
    async getFile({ url }) {
      const blobClient = containerClient.getBlobClient(url);

      const { contentLength, lastModified } = await blobClient.getProperties();

      return {
        url: url,
        metadata: {},
        path: {},
        size: contentLength ?? 0,
        uploadedAt: lastModified ?? new Date(),
      };
    },
    async requestUpload({ fileInfo }) {
      const nameId = uuidv4();
      const extension = fileInfo.extension
        ? `.${fileInfo.extension.replace('.', '')}`
        : '';
      const fileName = fileInfo.fileName ?? `${nameId}${extension}`;

      const blobClient = containerClient.getBlobClient(fileName);

      const url = blobClient.url;

      return {
        uploadUrl: url,
        accessUrl: url,
      };
    },
    async requestUploadParts() {
      throw new Error('Not implemented');
    },
    async completeMultipartUpload() {
      throw new Error('Not implemented');
    },
    async confirmUpload() {
      throw new Error('Not implemented');
    },
    async deleteFile({ url }) {
      const blobClient = containerClient.getBlobClient(url);
      await blobClient.delete();
      return {
        success: true,
      };
    },
  };
}
