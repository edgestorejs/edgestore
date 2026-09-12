import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReference } from './render';
import { docsOrigin, pageUrl, references } from './selection';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export async function packageReferences(
  packageName: string,
  root = repoRoot,
): Promise<Map<string, string>> {
  const selection = references[packageName];
  if (!selection)
    throw new Error(`No agent references configured for ${packageName}`);
  const manifest = JSON.parse(
    await readFile(
      path.join(root, 'packages', packageName, 'package.json'),
      'utf8',
    ),
  ) as { name: string; version: string };
  const files = new Map<string, string>();
  for (const reference of selection) {
    if (files.has(reference.file))
      throw new Error(`Duplicate reference: ${reference.file}`);
    const source = await readFile(
      path.join(root, 'docs/content/docs', reference.source),
      'utf8',
    );
    files.set(
      reference.file,
      renderReference(source, {
        sourceUrl: pageUrl(reference.source, docsOrigin(manifest.version)),
        sections: reference.sections,
      }),
    );
  }
  files.set(
    'README.md',
    [
      `# ${manifest.name} ${manifest.version}: agent references`,
      '',
      'These references ship with this exact package version. Prefer them over newer online examples.',
      'Generated from the authored documentation; do not edit these files directly.',
      'For other EdgeStore packages, read their own agent-docs directory and installed types.',
      '',
      ...selection.map(({ file }) => `- [${file}](${file})`),
      '',
    ].join('\n'),
  );
  return files;
}

export async function buildReferences(
  packageName: string,
  check = false,
  root = repoRoot,
): Promise<void> {
  const files = await packageReferences(packageName, root);
  const destination = path.join(root, 'packages', packageName, 'agent-docs');
  if (!check) await mkdir(destination, { recursive: true });
  const existing = await readdir(destination).catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  for (const [name, content] of files) {
    const file = path.join(destination, name);
    if (check) {
      if ((await readFile(file, 'utf8')) !== content)
        throw new Error(`Stale reference: ${file}`);
    } else {
      await writeFile(file, content);
    }
  }
  for (const name of existing) {
    if (files.has(name)) continue;
    if (check) throw new Error(`Unexpected generated reference: ${name}`);
    // Only this generated directory's Markdown artifacts are managed here.
    if (!name.endsWith('.md'))
      throw new Error(`Unexpected file in generated directory: ${name}`);
    await unlink(path.join(destination, name));
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const packages = args.filter((arg) => arg !== '--check');
  for (const name of packages.length ? packages : Object.keys(references)) {
    await buildReferences(name, args.includes('--check'));
  }
}
