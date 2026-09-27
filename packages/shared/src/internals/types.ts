import { type MaybePromise } from '../types';

export type ClientUploadTransform = (params: {
  file: File;
  extension: string;
  signal?: AbortSignal;
}) => MaybePromise<
  | File
  | Blob
  | {
      file: File | Blob;
      extension: string;
    }
>;

export type UploadOptions = {
  /**
   * e.g. 'my-file-name.jpg'
   *
   * By default, a unique file name will be generated for each upload.
   * If you want to use a custom file name, you can use this option.
   * If you use the same file name for multiple uploads, the previous file will be overwritten.
   * But it might take some time for the CDN cache to be cleared.
   * So maybe you will keep seeing the old file for a while.
   *
   * For providers supporting managed replacement, leave `manualFileName` empty and use `replaceTargetUrl`.
   */
  manualFileName?: string;
  /**
   * Replace an existing file when supported by the provider (not supported by S3).
   * It will automatically delete the existing file when the upload is complete.
   */
  replaceTargetUrl?: string;
  /**
   * For providers supporting temporary files (not S3), the file needs to be confirmed using `confirm`.
   * If the file is not confirmed within 24 hours, it will be deleted.
   *
   * This is useful for pages where the file is uploaded as soon as it is selected,
   * but the user can leave the page without submitting the form.
   *
   * This avoids unnecessary zombie files in the bucket.
   */
  temporary?: boolean;
  /**
   * Transform the file before it is validated and uploaded.
   *
   * This can be used to compress images, convert formats, encrypt files, etc.
   * The transformed file's size, MIME type, and extension will be used for the
   * upload request.
   */
  transform?: ClientUploadTransform;
};
