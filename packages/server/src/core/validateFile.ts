import { EdgeStoreError, type AnyBuilder } from '@edgestore/shared';
import { IMAGE_MIME_TYPES } from '../adapters/imageTypes';

export function validateFileForBucket(params: {
  bucket: AnyBuilder;
  fileInfo: { size: number; type: string };
}) {
  const { bucket, fileInfo } = params;

  if (
    bucket._def.type === 'IMAGE' &&
    !IMAGE_MIME_TYPES.includes(fileInfo.type)
  ) {
    throw new EdgeStoreError({
      code: 'MIME_TYPE_NOT_ALLOWED',
      message: 'Only images are allowed in this bucket',
      details: {
        allowedMimeTypes: IMAGE_MIME_TYPES,
        mimeType: fileInfo.type,
      },
    });
  }

  const maxSize = bucket._def.bucketConfig?.maxSize;
  if (maxSize !== undefined && fileInfo.size > maxSize) {
    throw new EdgeStoreError({
      code: 'FILE_TOO_LARGE',
      message: `File size is too big. Max size is ${maxSize}`,
      details: { maxFileSize: maxSize, fileSize: fileInfo.size },
    });
  }

  const accept = bucket._def.bucketConfig?.accept;
  if (
    accept &&
    !accept.some((value) => matchesMimeType(fileInfo.type, value))
  ) {
    throw new EdgeStoreError({
      code: 'MIME_TYPE_NOT_ALLOWED',
      message: `"${fileInfo.type}" is not allowed. Accepted types are ${JSON.stringify(accept)}`,
      details: { allowedMimeTypes: accept, mimeType: fileInfo.type },
    });
  }
}

function matchesMimeType(mimeType: string, accepted: string) {
  return accepted.endsWith('/*')
    ? mimeType.startsWith(accepted.slice(0, -1))
    : mimeType === accepted;
}
