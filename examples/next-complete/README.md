# Next.js complete example

A step-by-step page for trying EdgeStore's main features in a Next.js App
Router app. Each step runs one feature and shows whether it behaved as
expected, so you can test the whole library by working from top to bottom.

## Run it

From the repository root:

```bash
cp examples/next-complete/.env.example examples/next-complete/.env.local
pnpm install
pnpm --filter next-complete dev
```

Add your access key and secret key from the
[EdgeStore dashboard](https://dashboard.edgestore.dev) to `.env.local`, then
open <http://localhost:3000>.

## What to try

Pick **Alice** at the top of the page, then:

| Step                       | What it tests                                                  |
| -------------------------- | -------------------------------------------------------------- |
| 1. Upload a file           | Progress, cancellation, multipart uploads for files > 100 MiB  |
| 2. Validation              | `maxSize` and image type checks reject bad files               |
| 3. Temporary files         | `temporary` uploads and `confirm`                              |
| 4. Replace a file          | `replaceTargetUrl`                                             |
| 5. Transform and rename    | `transform` and `manualFileName`                               |
| 6. Images and access       | Thumbnails and a protected bucket with `accessControl`         |
| 7. Browse and manage files | Backend `list`, browser delete, server soft delete and restore |
| 8. Upload from the server  | Backend client uploads and the low-level `@edgestore/sdk`      |

Then switch users to check the access rules:

- **Signed out:** uploads fail because `beforeUpload` requires a user.
- **Bob:** Alice's private images show as blocked in step 7, and deleting her
  files fails because `beforeDelete` only allows the owner. Use **Signed URL**
  as Alice to share a private image with anyone for 60 seconds.

## How it is organized

- `src/lib/edgestore-server.ts` defines the three buckets and their rules.
- `src/lib/users.ts` fakes sign-in with a cookie so you can switch users
  without an auth provider. Switching users calls `reset()` so EdgeStore picks
  up the new context.
- `src/lib/actions.ts` holds the server actions that use the backend client
  and the SDK. The backend client skips `beforeUpload`, `beforeDelete`, and
  `accessControl`, so each action checks the user itself.
- `src/components/` has one component per step.
