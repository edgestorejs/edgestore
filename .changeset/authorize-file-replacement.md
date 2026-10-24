---
'@edgestore/server': patch
'@edgestore/shared': patch
---

Require `beforeDelete` to replace or overwrite existing files from the browser.

Replacing a file deletes it, so a browser upload with `replaceTargetUrl`, or
with a `manualFileName` that matches an existing file, now runs the bucket's
`beforeDelete` on that file first. Replacement targets must be in the same
bucket. Without `beforeDelete` these uploads fail. Generated file names and
backend uploads are unchanged.

Custom providers that let the browser choose file names should call the new
`authorizeOverwrite` request parameter with any file already at the key.
