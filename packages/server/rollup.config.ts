import { type RollupOptions } from 'rollup';
import { buildConfig } from '../../scripts/getRollupConfig';

export const input = [
  'src/index.ts',
  'src/core/index.ts',
  'src/adapters/express/index.ts',
  'src/adapters/fastify/index.ts',
  'src/adapters/next/pages/index.ts',
  'src/adapters/next/app/index.ts',
  'src/adapters/start/index.ts',
  'src/providers/aws/index.ts',
  'src/providers/azure/index.ts',
  'src/providers/edgestore/index.ts',
];

export default function rollup(): RollupOptions[] {
  return buildConfig({
    input,
    packageDir: __dirname,
  });
}
