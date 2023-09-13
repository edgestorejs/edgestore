/**
 * This will add the necessary query param to the url
 * to make the browser download the file instead of opening it.
 *
 * You can also override the name of the file by passing the name param.
 */
export function getDownloadUrl(url: string, name?: string) {
  const urlObj = new URL(url);
  urlObj.searchParams.set('download', name ?? 'true');
  return urlObj.toString();
}

/**
 * This will format the file size to a human readable format.
 *
 * @example 1024 => 1 KB
 */
export function formatFileSize(bytes?: number) {
  if (!bytes) {
    return '0 Bytes';
  }
  bytes = Number(bytes);
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const dm = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
