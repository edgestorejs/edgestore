import type { PutObjectCommandInput } from '@aws-sdk/client-s3';

/** Keep signed object settings and the browser's actual PUT headers aligned. */
export function objectUploadHeaders(input: PutObjectCommandInput) {
  const headers: Record<string, string> = {};
  const fields = {
    ContentType: 'Content-Type',
    CacheControl: 'Cache-Control',
    ContentDisposition: 'Content-Disposition',
    StorageClass: 'x-amz-storage-class',
    ServerSideEncryption: 'x-amz-server-side-encryption',
    SSEKMSKeyId: 'x-amz-server-side-encryption-aws-kms-key-id',
    Tagging: 'x-amz-tagging',
  } as const;
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    const value = input[field];
    if (value !== undefined) headers[fields[field]] = value;
  }
  for (const [key, value] of Object.entries(input.Metadata ?? {})) {
    headers[`x-amz-meta-${key}`] = value;
  }
  return headers;
}
