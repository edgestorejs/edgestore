import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { type RollupOptions } from 'rollup';
import del from 'rollup-plugin-delete';
import externals from 'rollup-plugin-node-externals';
import { swc } from 'rollup-plugin-swc3';

const isWatchMode = process.argv.includes('--watch');
const extensions = ['.ts', '.tsx'];

type Options = {
  input: string[];
  packageDir: string;
};

export function buildConfig({ input, packageDir }: Options): RollupOptions[] {
  const resolvedInput = input.map((file) => path.resolve(packageDir, file));
  const options: Options = {
    input: resolvedInput,
    packageDir,
  };

  return [types(options), lib(options)];
}

function types({ input, packageDir }: Options): RollupOptions {
  return {
    input,
    output: {
      dir: `${packageDir}/dist`,
      preserveModules: true,
      preserveModulesRoot: 'src',
    },
    plugins: [
      !isWatchMode &&
        del({
          targets: `${packageDir}/dist`,
        }),
      externals({
        packagePath: path.resolve(packageDir, 'package.json'),
        deps: true,
        devDeps: true,
        peerDeps: true,
      }),
      typescript({
        exclude: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
        tsconfig: path.resolve(packageDir, 'tsconfig.build.json'),
        outDir: path.resolve(packageDir, 'dist'),
      }),
    ],
  };
}

function lib({ input, packageDir }: Options): RollupOptions {
  return {
    input,
    output: [
      {
        dir: `${packageDir}/dist`,
        format: 'cjs',
        entryFileNames: '[name].js',
        chunkFileNames: '[name]-[hash].js',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
      {
        dir: `${packageDir}/dist`,
        format: 'esm',
        entryFileNames: '[name].mjs',
        chunkFileNames: '[name]-[hash].mjs',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    ],
    plugins: [
      externals({
        packagePath: path.resolve(packageDir, 'package.json'),
      }),
      nodeResolve({
        extensions,
      }),
      swc({
        tsconfig: false,
        jsc: {
          target: 'es2020',
          transform: {
            react: {
              useBuiltins: true,
            },
          },
          // TODO: externalHelpers can make the bundle smaller,
          // but for some reason it is breaking the `pnpm vite-express:dev` and `pnpm cra-express:dev` examples.
          // externalHelpers: true,
        },
      }),
    ],
  };
}
