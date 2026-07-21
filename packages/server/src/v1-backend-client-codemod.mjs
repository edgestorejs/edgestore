#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const extensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.cts', '.mts']);
const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error('Usage: v1-backend-client-codemod.mjs <path> [...]');
  process.exitCode = 1;
} else {
  for (const target of targets) await visit(path.resolve(target));
}

async function visit(target) {
  const info = await stat(target);
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      await visit(path.join(target, entry));
    }
    return;
  }
  if (!extensions.has(path.extname(target))) return;

  const source = await readFile(target, 'utf8');
  if (
    !source.includes("'@edgestore/server/core'") &&
    !source.includes('"@edgestore/server/core"')
  ) {
    return;
  }
  const updated = source.replaceAll(
    /\binitEdgeStoreClient\b/g,
    'createEdgeStoreClient',
  );
  if (updated === source) return;

  await writeFile(target, updated);
  console.log(path.relative(process.cwd(), target));
}
