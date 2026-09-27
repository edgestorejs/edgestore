import { type Page } from '@/lib/source';
import {
  DOCS_GIT_REF,
  DOCS_ORIGIN,
  GITHUB_OWNER,
  GITHUB_REPO,
} from './constants';

export async function getLLMText(page: Page) {
  const processed = await page.data.getText('processed');

  return `# EdgeStore Docs: ${page.data.title}
URL: ${DOCS_ORIGIN}${page.url}
Source: https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/${DOCS_GIT_REF}/docs/content/docs/${page.path}

${processed}`;
}
