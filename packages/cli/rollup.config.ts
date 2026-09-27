import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodeResolve from '@rollup/plugin-node-resolve';
import { type RollupOptions } from 'rollup';
import externals from 'rollup-plugin-node-externals';
import { swc } from 'rollup-plugin-swc3';

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const isWatchMode = process.argv.includes('--watch');

export default function rollup(): RollupOptions {
  if (!isWatchMode) {
    rmSync(path.resolve(packageDir, 'dist'), { recursive: true, force: true });
  }

  return {
    input: path.resolve(packageDir, 'src/bin.ts'),
    output: {
      file: path.resolve(packageDir, 'dist/bin.mjs'),
      format: 'esm',
      banner: '#!/usr/bin/env node',
    },
    plugins: [
      externals({
        packagePath: path.resolve(packageDir, 'package.json'),
      }),
      nodeResolve({
        extensions: ['.ts'],
      }),
      swc({
        tsconfig: false,
        jsc: {
          target: 'es2022',
        },
      }),
    ],
  };
}
