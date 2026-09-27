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

  return { toUrl: objectKeyToUrl, fromReference, normalizeRelativePath };
}
