export function formatFileSize(bytes: number | string) {
  bytes = Number(bytes);
  if (bytes === 0) {
    return '0 B';
  }
  const k = 1024;
  const dm = 2;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatNumber(num: number | string) {
  num = Number(num);

  if (num < 1000) {
    return num.toString(); // Return the number as is if less than 1000
  } else if (num < 1000000) {
    return parseFloat((num / 1000).toFixed(2)) + 'K'; // Convert to K for thousands
  } else {
    return parseFloat((num / 1000000).toFixed(2)) + 'M'; // Convert to M for millions
  }
}
