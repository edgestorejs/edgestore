import { type Page } from '@/lib/source';
import {
  DOCS_GIT_REF,
  DOCS_ORIGIN,
  GITHUB_OWNER,
  GITHUB_REPO,
} from './constants';

export async function getLLMText(page: Page) {
  const processed = await page.data.getText('processed');

  return `# EdgeStore ${page.url.startsWith('/v0/') ? 'v0 (stable)' : 'v1 (prerelease; install @next)'} Docs: ${page.data.title}
URL: ${DOCS_ORIGIN}${page.url}
Source: https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/${DOCS_GIT_REF}/docs/content/${page.url.startsWith('/v0/') ? 'v0' : 'docs'}/${page.path}

${processed}`;
}
