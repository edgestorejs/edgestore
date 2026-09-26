export function createObjectKeys(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

  function objectKeyToUrl(objectKey: string) {
    const encodedKey = objectKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    return `${normalizedBaseUrl}/${encodedKey}`;
  }

  function urlToObjectKey(edgestoreBucketName: string, url: string) {
    let objectKey: string;
    try {
      const fileUrl = new URL(url);
      const providerUrl = new URL(`${normalizedBaseUrl}/`);
      if (
        fileUrl.origin !== providerUrl.origin ||
        !fileUrl.pathname.startsWith(providerUrl.pathname)
      ) {
        throw new Error();
      }
      objectKey = decodeURIComponent(
        fileUrl.pathname.slice(providerUrl.pathname.length),
      );
    } catch {
      throw new Error('File URL does not belong to this S3 provider.');
    }

    if (!objectKey.startsWith(`${edgestoreBucketName}/`)) {
      throw new Error(
        `File does not belong to EdgeStore bucket "${edgestoreBucketName}".`,
      );
    }
    return objectKey;
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

  function fromReference(
    bucketName: string,
    file: { url: string } | { key: string },
  ) {
    if ('url' in file) return urlToObjectKey(bucketName, file.url);
    const key = normalizeRelativePath(file.key);
    if (key !== file.key || !key.startsWith(`${bucketName}/`)) {
      throw new Error(
        `File does not belong to EdgeStore bucket "${bucketName}".`,
      );
    }
    return key;
  }
  return { toUrl: objectKeyToUrl, fromReference, normalizeRelativePath };
}
