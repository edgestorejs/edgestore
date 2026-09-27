/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import './src/env.js';
import { createMDX } from 'fumadocs-mdx/next';
import { getDocsDeployment } from './src/lib/docsDeployment.ts';

getDocsDeployment({
  channel: process.env.DOCS_RELEASE_CHANNEL,
  branch:
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.GITHUB_HEAD_REF ??
    process.env.GITHUB_REF_NAME,
});

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: ['typescript', 'twoslash'],
  async redirects() {
    return [
      {
        source: '/docs/llms-vibe-coding',
        destination: '/docs/agents',
        permanent: true,
      },
      {
        source: '/docs/llms-vibe-coding.md',
        destination: '/docs/agents.md',
        permanent: true,
      },
      {
        source: '/docs/providers/aws',
        destination: '/docs/providers/s3',
        permanent: true,
      },
      {
        source: '/docs/providers/azure',
        destination: '/docs/providers/azure-blob',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.md',
        destination: '/llms.mdx/:path*',
      },
    ];
  },
};

export default withMDX(config);
