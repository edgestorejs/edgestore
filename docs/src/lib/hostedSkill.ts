import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function skillDocument(
  file: 'SKILL.md' | 'references/hosted-setup.md',
) {
  const content = await readFile(
    path.join(process.cwd(), '../skills/edgestore-setup', file),
    'utf8',
  );
  return new Response(
    content.replaceAll(
      '](references/',
      '](/skills/edgestore-setup/references/',
    ),
    { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } },
  );
}
