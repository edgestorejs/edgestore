import fs from 'node:fs';
import path from 'node:path';
import prettier from 'prettier';

// create directories on the way if they don't exist
function writeFileSyncRecursive(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

export async function generateEntrypoints(inputs) {
  const sortedInputs = [...inputs].sort();
  // set some defaults for the package.json
  const pkgJsonPath = path.resolve('package.json');
  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

  // Keep top-level fields consistent with tsdown output naming
  pkgJson.main = './dist/index.cjs';
  pkgJson.module = './dist/index.mjs';
  pkgJson.types = './dist/index.d.cts';

  pkgJson.files = ['dist', 'src', 'README.md', 'LICENSE'];
  // Match tRPC's export shape to include types per condition.
  pkgJson.exports = {
    './package.json': './package.json',
    '.': {
      import: { types: './dist/index.d.mts', default: './dist/index.mjs' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    },
  };

  // Track generated artifacts for Turbo caching (tRPC-style).
  const scriptOutputs = new Set();
  scriptOutputs.add('package.json');
  scriptOutputs.add('dist/**');

  sortedInputs
    .filter((i) => i !== 'src/index.ts') // index included by the default above
    .forEach((i) => {
      // first, exclude 'src' part of the path
      const parts = i.split('/').slice(1);
      const pathWithoutSrc = parts.join('/');

      // if filename is index.ts, importPath is a path until index.ts,
      // otherwise, importPath is the path without the file extension
      const importPath =
        parts.at(-1) === 'index.ts' || parts.at(-1) === 'index.tsx'
          ? parts.slice(0, -1).join('/')
          : pathWithoutSrc.replace(/\.(ts|tsx)$/, '');

      // write this entrypoint to the package.json exports field
      const esm = './dist/' + pathWithoutSrc.replace(/\.(ts|tsx)$/, '.mjs');
      const cjs = './dist/' + pathWithoutSrc.replace(/\.(ts|tsx)$/, '.cjs');
      pkgJson.exports[`./${importPath}`] = {
        import: { types: esm.replace(/\.mjs$/, '.d.mts'), default: esm },
        require: { types: cjs.replace(/\.cjs$/, '.d.cts'), default: cjs },
      };

      // create the barrel file, linking the declared exports to the compiled files in dist
      const importDepth = importPath.split('/').length || 1;

      // Use POSIX separators so the generated JS is valid on Windows too.
      // Point at the built file base path (no extension) so TS can resolve `.d.cts/.d.mts`,
      // and require the `.cjs` file explicitly.
      const distPathNoExt = pathWithoutSrc.replace(/\.(ts|tsx)$/, '');
      const resolvedImportNoExt = [
        ...Array(importDepth).fill('..'),
        'dist',
        distPathNoExt,
      ].join('/');

      // Also generate a per-entrypoint package.json (tRPC-style).
      // This helps some tooling resolve types + main/module for deep imports.
      const entrypointPkgJsonFile = path.resolve(importPath, 'package.json');
      const entrypointPkgJsonContent = JSON.stringify({
        main: `${resolvedImportNoExt}.cjs`,
        module: `${resolvedImportNoExt}.mjs`,
        types: `${resolvedImportNoExt}.d.cts`,
      });
      writeFileSyncRecursive(entrypointPkgJsonFile, entrypointPkgJsonContent);
    });

  // write top-level directories to package.json 'files' field
  Object.keys(pkgJson.exports).forEach((entrypoint) => {
    // get the top-level directory of the entrypoint, e.g. 'adapters/aws-lambda' -> 'adapters'
    const topLevel = entrypoint.split('/')[1];

    if (!topLevel) return;
    if (pkgJson.files.includes(topLevel)) return;
    pkgJson.files.push(topLevel);
    if (topLevel !== 'package.json') scriptOutputs.add(`${topLevel}/**`);
  });

  // Exclude test files in builds
  pkgJson.files.push('!**/*.test.*');

  // write package.json
  const formattedPkgJson = await prettier.format(JSON.stringify(pkgJson), {
    parser: 'json-stringify',
    printWidth: 80,
    endOfLine: 'auto',
  });
  fs.writeFileSync(pkgJsonPath, formattedPkgJson, 'utf8');

  // Update package-local turbo.json outputs (tRPC-style) so Turbo cache includes generated entrypoints.
  const turboPath = path.resolve('turbo.json');
  if (fs.existsSync(turboPath)) {
    const turboJson = JSON.parse(fs.readFileSync(turboPath, 'utf8'));
    turboJson.tasks ??= {};
    turboJson.tasks.build ??= {};
    turboJson.tasks.build.outputs = [...scriptOutputs];
    const formattedTurboJson = await prettier.format(
      JSON.stringify(turboJson),
      {
        parser: 'json',
        printWidth: 80,
        endOfLine: 'auto',
      },
    );
    fs.writeFileSync(turboPath, formattedTurboJson, 'utf8');
  }
}
