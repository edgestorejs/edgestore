import path from 'path';
import { fileURLToPath } from 'url';
import { type RollupOptions } from 'rollup';
import { buildConfig } from '../../scripts/getRollupConfig';

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export const input = [
  'src/index.ts',
  'src/core/index.ts',
  'src/adapters/astro/index.ts',
  'src/adapters/express/index.ts',
  'src/adapters/fastify/index.ts',
  'src/adapters/hono/index.ts',
  'src/adapters/next/pages/index.ts',
  'src/adapters/next/app/index.ts',
  'src/adapters/remix/index.ts',
  'src/adapters/start/index.ts',
  'src/providers/azure-blob/index.ts',
  'src/providers/edgestore/index.ts',
  'src/providers/s3/index.ts',
];

export default function rollup(): RollupOptions[] {
  return buildConfig({
    input,
    packageDir,
  });
}
