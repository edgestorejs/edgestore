const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function selectPreviewImages(files: readonly File[], limit: number) {
  return files
    .filter((file) => IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_SIZE)
    .slice(0, limit);
}

export function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
