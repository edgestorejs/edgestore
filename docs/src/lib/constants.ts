import { getDocsDeployment } from './docsDeployment';

export const DISCORD_INVITE_URL = 'https://discord.gg/HvrnhRTfgQ';
export const GITHUB_OWNER = 'edgestorejs';
export const GITHUB_REPO = 'edgestore';
const deployment = getDocsDeployment({
  channel: process.env.DOCS_RELEASE_CHANNEL,
  branch:
    process.env.VERCEL_GIT_COMMIT_REF ??
    process.env.GITHUB_HEAD_REF ??
    process.env.GITHUB_REF_NAME,
});
export const DOCS_ORIGIN = deployment.origin;
export const DOCS_GIT_REF = deployment.gitRef;
export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const SPONSOR_URL = 'https://github.com/sponsors/perfectbase';
export const YOUTUBE_URL = 'https://youtube.com/@perfectbase';
export const X_URL = 'https://x.com/edgestorejs';
