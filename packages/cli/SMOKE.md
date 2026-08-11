# CLI development smoke test

This smoke test exercises a built or installed CLI against a pre-provisioned
development project. It creates a protected bucket, uploads one file, creates
temporary project and account credentials, and removes every resource it
creates.

Build the local CLI, then run:

```sh
pnpm --filter @edgestore/cli build

EDGESTORE_SMOKE_ALLOW_MUTATIONS=1 \
EDGESTORE_SMOKE_API_URL=https://api-dev.edgestore.dev \
EDGESTORE_SMOKE_PROJECT=your-project-base-path \
pnpm --filter @edgestore/cli test:smoke:dev
```

The normal CLI credential resolution applies. Set `EDGESTORE_TOKEN` for CI or
log in to the selected API environment before running locally.

Set `EDGESTORE_SMOKE_CLI` to test another executable instead of the local
`dist/bin.mjs` build:

```sh
EDGESTORE_SMOKE_CLI=edgestore \
EDGESTORE_SMOKE_ALLOW_MUTATIONS=1 \
EDGESTORE_SMOKE_API_URL=https://api-dev.edgestore.dev \
EDGESTORE_SMOKE_PROJECT=your-project-base-path \
pnpm --filter @edgestore/cli test:smoke:dev
```

The runner refuses the production API and hosts that do not clearly look like
development, staging, test, preview, or loopback environments.
