import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function skillAssets(sourceRoot = root) {
  const files: Record<string, string> = {};
  const source = path.join(sourceRoot, 'skills');
  async function visit(relative: string): Promise<void> {
    const entries = await readdir(path.join(source, relative), {
      withFileTypes: true,
    });
    for (const entry of entries.sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const name = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile() && /\.(md|yaml)$/.test(name))
        files[name] = await readFile(path.join(source, name), 'utf8');
      else throw new Error(`Unsupported skill asset: ${name}`);
    }
  }
  await visit('edgestore-setup');
  const revision = createHash('sha256')
    .update(JSON.stringify(files))
    .digest('hex');
  return { schemaVersion: 1, revision, files };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const file = path.join(root, 'packages/cli/agent-assets/skills.json');
  const output = `${JSON.stringify(await skillAssets(), null, 2)}\n`;
  if (process.argv.includes('--check')) {
    if ((await readFile(file, 'utf8')) !== output)
      throw new Error('CLI skill assets are stale.');
  } else {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, output);
  }
}
