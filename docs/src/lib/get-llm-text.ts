import { type Page } from '@/lib/source';
import { GITHUB_OWNER, GITHUB_REPO } from './constants';

export async function getLLMText(page: Page) {
  const processed = await page.data.getText('processed');

  return `# EdgeStore Docs: ${page.data.title}
URL: ${page.url}
Source: https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/main/docs/content/docs/${page.path}

${processed}`;
}
