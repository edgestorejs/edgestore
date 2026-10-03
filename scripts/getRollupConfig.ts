import { rm } from 'node:fs/promises';
import path from 'path';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { type Plugin, type RollupOptions } from 'rollup';
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
      !isWatchMode && {
        name: 'clean-dist',
        async buildStart() {
          await rm(path.resolve(packageDir, 'dist'), {
            force: true,
            recursive: true,
          });
        },
      },
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
      addDeclarationImportExtensions(),
    ],
  };
}

function addDeclarationImportExtensions(): Plugin {
  return {
    name: 'add-declaration-import-extensions',
    generateBundle(_options, bundle) {
      const declarationFiles = new Set(
        Object.values(bundle)
          .filter(
            (output) =>
              output.type === 'asset' && output.fileName.endsWith('.d.ts'),
          )
          .map((output) => output.fileName),
      );

      for (const output of Object.values(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.d.ts')) {
          continue;
        }

        const source =
          typeof output.source === 'string'
            ? output.source
            : Buffer.from(output.source).toString('utf8');

        output.source = source.replace(
          /(\b(?:from\s+|import\s*(?:\(\s*)?)['"])(\.\.?\/[^'"]+)(['"])/g,
          (_match, prefix: string, specifier: string, suffix: string) => {
            if (/\.(?:[cm]?[jt]sx?|json)$/.test(specifier)) {
              return `${prefix}${specifier}${suffix}`;
            }

            const resolvedSpecifier = path.posix.normalize(
              path.posix.join(path.posix.dirname(output.fileName), specifier),
            );
            const extension = declarationFiles.has(
              `${resolvedSpecifier}/index.d.ts`,
            )
              ? '/index.js'
              : '.js';

            return `${prefix}${specifier}${extension}${suffix}`;
          },
        );
      }
    },
  };
}

function lib({ input, packageDir }: Options): RollupOptions {
  return {
    input,
    output: {
      dir: `${packageDir}/dist`,
      format: 'esm',
      entryFileNames: '[name].js',
      chunkFileNames: '[name]-[hash].js',
      preserveModules: true,
      preserveModulesRoot: 'src',
    },
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
