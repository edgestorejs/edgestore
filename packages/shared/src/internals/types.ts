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
   * If you want to replace an existing file immediately leave the `manualFileName` option empty and use the `replaceTargetUrl` option.
   */
  manualFileName?: string;
  /**
   * Use this to replace an existing file.
   * It will automatically delete the existing file when the upload is complete.
   */
  replaceTargetUrl?: string;
  /**
   * If true, the file needs to be confirmed by using the `confirmUpload` function.
   * If the file is not confirmed within 24 hours, it will be deleted.
   *
   * This is useful for pages where the file is uploaded as soon as it is selected,
   * but the user can leave the page without submitting the form.
   *
   * This avoids unnecessary zombie files in the bucket.
   */
  temporary?: boolean;
};
