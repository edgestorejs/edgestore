# Hono Basic Example

This app is just a backend for EdgeStore using Hono.
You will want to run it together with the frontend examples (e.g. Vite or CRA).

## How to run

1. Install dependencies

```bash
pnpm install
```

2. Add your environment variables to `.env.local`

The development command loads `.env.local`. Reuse your deployment's environment
configuration in production; `pnpm start` expects variables supplied by the host.
Never copy backend keys into frontend `VITE_*` variables.

Set `FRONTEND_ORIGIN` to your frontend's exact origin if it differs from
`http://localhost:5173`. Credentialed CORS is restricted to this origin and the
EdgeStore route. For production, prefer a same-origin reverse proxy and configure
the frontend's EdgeStore base path for that deployment.

See the [v1 preview quick start](https://next.edgestore.dev/docs/quick-start).

3. Run the development server

```bash
pnpm dev
```

4. Check edgestore is running: [http://localhost:3001/edgestore/health](http://localhost:3001/edgestore/health)

5. Open your frontend and try to upload something!
