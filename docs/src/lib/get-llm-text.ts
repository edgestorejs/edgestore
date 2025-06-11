import { type Page } from '@/lib/source';
import { remarkInstall } from 'fumadocs-docgen';
import { remarkInclude } from 'fumadocs-mdx/config';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import { GITHUB_OWNER, GITHUB_REPO } from './constants';

const processor = remark()
  .use(remarkMdx)
  .use(remarkInclude)
  .use(remarkGfm)
  .use(remarkInstall);

export async function getLLMText(page: Page) {
  const processed = await processor.process({
    path: page.data._file.absolutePath,
    value: page.data.content,
  });

  return `# EdgeStore Docs: ${page.data.title}
URL: ${page.url}
Source: https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/refs/heads/main/docs/content/docs/${page.file.path}

${processed.value.toString()}`;
}
