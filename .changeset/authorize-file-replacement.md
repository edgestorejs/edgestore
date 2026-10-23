---
'@edgestore/server': patch
'@edgestore/shared': patch
---

Require `beforeDelete` to replace or overwrite existing files from the browser.

Replacing a file deletes it, so browser uploads now get the same authorization
as browser deletion:

- An upload with `replaceTargetUrl` runs the bucket's `beforeDelete` with the
  file being replaced, and the target must belong to the same bucket.
- An upload with a `manualFileName` that matches an existing file runs
  `beforeDelete` with that file before EdgeStore issues upload or signed read
  URLs for it. This applies to the EdgeStore, S3, and Azure Blob providers.

If the bucket has no `beforeDelete`, these uploads now fail with "You need to
define beforeDelete if you want to replace or overwrite existing files from the
frontend." If `beforeDelete` returns `false`, they fail with
`UPLOAD_NOT_ALLOWED`. Uploads with generated file names, and backend uploads,
are unchanged.

Custom providers that let the browser choose file names should call the new
`authorizeOverwrite` request parameter with any existing file at the upload's
key.
