# Hono Basic Example

An EdgeStore backend using Hono. Run it with a React frontend, such as the
[Vite example](../vite-basic).

## How to run

1. Install dependencies

```bash
npm install
```

2. Add your environment variables to `.env.local`

The development command loads `.env.local`. Reuse your deployment's environment
configuration in production; `npm start` expects variables supplied by the host.

Set `FRONTEND_ORIGIN` to your frontend's exact origin if it differs from
`http://localhost:5173`. In production, serve the frontend and backend on the same
domain using a reverse proxy.

See [Quick start](https://edgestore.dev/docs/quick-start) for the keys.

3. Run the development server

```bash
npm run dev
```

4. Check edgestore is running: [http://localhost:3001/edgestore/health](http://localhost:3001/edgestore/health)

5. Try an upload from your frontend.
