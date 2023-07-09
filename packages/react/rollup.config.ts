import { RollupOptions } from 'rollup';
import { buildConfig } from '../../scripts/getRollupConfig';

export const input = [
  'src/index.tsx',
  'src/server/index.ts',
  'src/server/adapters/next/index.ts',
  'src/server/providers/AWSProvider.ts',
  'src/server/providers/EdgeStoreProvider.ts',
];

export default function rollup(): RollupOptions[] {
  return buildConfig({
    input,
    packageDir: __dirname,
  });
}
