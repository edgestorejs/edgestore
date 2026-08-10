# Next.js complete example

A focused App Router playground for exercising EdgeStore's client, backend
client, and low-level SDK without adding authentication, a database, or a UI
framework.

## Covered features

- Public file, public image, and access-controlled image buckets
- File size and MIME type validation
- Typed input, context-derived paths, metadata, and lifecycle hooks
- Client upload progress, two-item concurrency, cancellation, retry, and errors
- Temporary uploads, confirmation, replacement, singular and batch mutations
- Manual filenames and client/backend text transforms
- Automatic multipart upload with an optional 101 MiB fixture
- Image thumbnails, protected reads, and signed URLs
- Backend listing with path, metadata, date filters, and cursor pagination
- Backend upload from strings, blobs, and remote URLs
- Lookup by file ID, soft deletion, and restore
- Low-level SDK uploads plus health, project, and bucket inspection
- Deterministic guest, user, owner, and admin access-control scenarios

The identity selector uses an HTTP-only demo cookie. It intentionally avoids a
real authentication dependency while still exercising context reset and
access-control behavior.

## Run locally

From the repository root:

```bash
cp examples/next-complete/.env.example examples/next-complete/.env.local
pnpm install
pnpm --filter next-complete dev
```

Add an EdgeStore access key and secret key to `.env.local`, then open
<http://localhost:3000>.

The example uses `http://localhost:3000/api/edgestore` to proxy protected files
in development. Set `EDGE_STORE_EXAMPLE_BASE_URL` if the app runs on another
origin or port.

## Useful scenarios

1. Select Alice, upload a temporary file, and confirm it from the upload list.
2. Upload a public image as Alice, switch to Bob, and verify client deletion is
   rejected. Switch to Admin and delete it.
3. Upload a private image, request a 60-second signed URL, then switch users to
   compare protected access.
4. Select `publicImages` and add the MIME or 11 MiB error fixture.
5. Select `publicFiles` and add the 101 MiB fixture to exercise multipart upload
   and cancellation.
6. Soft-delete a file from the backend controls, retain its ID from the result,
   then restore it.
7. Compare a router backend upload with a low-level SDK upload and inspect the
   returned progress phases.
