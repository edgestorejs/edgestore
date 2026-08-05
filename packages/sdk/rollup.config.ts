import path from 'path';
import { fileURLToPath } from 'url';
import { type RollupOptions } from 'rollup';
import { buildConfig } from '../../scripts/getRollupConfig';

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export const input = ['src/index.ts'];

export default function rollup(): RollupOptions[] {
  return buildConfig({
    input,
    packageDir,
  });
}
