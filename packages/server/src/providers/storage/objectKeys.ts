import type { MaybePromise, RequestUploadParams } from '@edgestore/shared';

export type ObjectPathFnArgs = {
  /** Logical EdgeStore router bucket name. */
  edgestoreBucketName: string;
  /** File info after EdgeStore path and metadata generation. */
  fileInfo: RequestUploadParams['fileInfo'];
  /** Default object path relative to the logical bucket prefix. */
  defaultPath: string;
};

/** Returns an object path relative to the logical bucket prefix. */
export type ObjectPathFn = (args: ObjectPathFnArgs) => MaybePromise<string>;

export function createObjectKeys(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  function objectKeyToUrl(objectKey: string) {
    const encodedKey = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${normalizedBaseUrl}/${encodedKey}`;
  }

  function urlToObjectKey(url: string) {
    try {
      const fileUrl = new URL(url);
      const providerUrl = new URL(`${normalizedBaseUrl}/`);
      if (
        fileUrl.origin !== providerUrl.origin ||
        !fileUrl.pathname.startsWith(providerUrl.pathname)
      ) {
        throw new Error();
      }
      return decodeURIComponent(
        fileUrl.pathname.slice(providerUrl.pathname.length),
      );
    } catch {
      throw new Error('File URL does not belong to this S3 provider.');
    }
  }

  function normalizeRelativePath(value: string) {
    const path = value.replace(/^\/+|\/+$/g, '');
    if (
      path.length === 0 ||
      path.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error('S3 paths must stay within the EdgeStore bucket prefix.');
    }
    return path;
  }

  /** Keys from both URLs and key references must stay inside the logical bucket. */
  function fromReference(
    bucketName: string,
    file: { url: string } | { key: string },
  ) {
    const key = 'url' in file ? urlToObjectKey(file.url) : file.key;
    if (
      normalizeRelativePath(key) !== key ||
      !key.startsWith(`${bucketName}/`)
    ) {
      throw new Error(
        `File does not belong to EdgeStore bucket "${bucketName}".`,
      );
    }
    return key;
  }

  /**
   * Resolves the object key for an upload. The logical bucket is always the
   * first key segment, so router authorization for one bucket cannot reach
   * objects from another.
   */
  async function forUpload(
    edgestoreBucketName: string,
    fileInfo: RequestUploadParams['fileInfo'],
    path?: ObjectPathFn,
  ) {
    const extension = fileInfo.extension
      ? `.${fileInfo.extension.replace(/^\./, '')}`
      : '';
    const defaultPath = [
      ...(fileInfo.isPublic ? ['_public'] : []),
      ...fileInfo.path.map((part) => part.value),
      fileInfo.fileName ?? `${crypto.randomUUID()}${extension}`,
    ].join('/');
    const relativePath = normalizeRelativePath(
      path
        ? await path({ edgestoreBucketName, fileInfo, defaultPath })
        : defaultPath,
    );
    return {
      key: `${edgestoreBucketName}/${relativePath}`,
      pathArgs: { edgestoreBucketName, fileInfo, defaultPath },
    };
  }

  return { toUrl: objectKeyToUrl, fromReference, forUpload };
}
