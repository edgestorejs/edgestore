import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';
import {
  isIdentifier,
  isObjectProperty,
  isStringLiteral,
  traverseFast,
  type ObjectExpression,
} from '@babel/types';
import { validatePath } from './agent/files';
import { inspectApplication } from './application';
import { dotenvValue } from './dotenv';

export type DoctorCheck = {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  detail: string;
};

export async function localApplicationChecks(
  directory: string,
): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  let application: Awaited<ReturnType<typeof inspectApplication>>;
  try {
    application = await inspectApplication(directory);
  } catch {
    return [
      {
        name: 'Application',
        status: 'skip',
        detail:
          'No readable package manifest; select an application with --cwd.',
      },
    ];
  }
  checks.push({
    name: 'Application',
    status: application.framework === 'unknown' ? 'skip' : 'pass',
    detail: `${application.framework} (${application.role})`,
  });
  checks.push({
    name: 'Package compatibility',
    status: ['mixed', 'unsupported'].includes(application.compatibility)
      ? 'fail'
      : application.compatibility === 'v1'
        ? 'pass'
        : 'warn',
    detail:
      application.compatibility === 'legacy'
        ? 'Installed 0.2 packages: choose maintenance or migration explicitly.'
        : `${application.compatibility}; API authority is each installed package's references.`,
  });
  for (const pkg of application.packages) {
    if (pkg.status === 'unsupported-resolution')
      checks.push({
        name: pkg.name,
        status: 'warn',
        detail:
          "Yarn Plug'n'Play resolution is unsupported; installed versions and references could not be inspected.",
      });
    if (pkg.status === 'not-resolved')
      checks.push({
        name: pkg.name,
        status: 'warn',
        detail:
          'Declared but not resolved; install dependencies in the selected workspace.',
      });
  }
  for (const file of application.environmentFiles.filter(
    (file) => !/\.(example|sample|template)$/.test(file),
  )) {
    try {
      await validatePath(file, directory);
      if ((await stat(file)).size > 128_000) throw new Error();
      const contents = await readFile(file, 'utf8');
      const exposed = [
        ...contents.matchAll(
          /^(?:export\s+)?((?:VITE_|NEXT_PUBLIC_|PUBLIC_)\w*EDGE_?STORE\w*(?:SECRET|ACCESS)_KEY)\s*=/gm,
        ),
      ].some((match) => Boolean(dotenvValue(contents, match[1]!)));
      const backendKeys = Boolean(
        dotenvValue(contents, 'EDGE_STORE_SECRET_KEY') ||
        dotenvValue(contents, 'EDGE_STORE_ACCESS_KEY'),
      );
      if (exposed || (backendKeys && application.role === 'frontend')) {
        checks.push({
          name: 'Environment boundary',
          status: 'fail',
          detail: `${path.basename(file)} contains project credentials in a frontend destination. Move them to the backend and rotate any exposed secret.`,
        });
      }
    } catch {
      checks.push({
        name: 'Environment inspection',
        status: 'skip',
        detail: `${path.basename(file)} was not safely readable.`,
      });
    }
  }
  const sources = await readSources(directory);
  let adapter = false;
  let provider = false;
  let parsedFiles = 0;
  for (const source of sources.files) {
    const facts = inspectSource(source.text, application.role === 'frontend');
    if (!facts) continue;
    parsedFiles++;
    adapter ||= facts.adapter;
    provider ||= facts.provider;
    for (const detail of facts.warnings)
      checks.push({ name: `Source: ${source.name}`, status: 'warn', detail });
  }
  checks.push({
    name: 'Source inspection',
    status: 'skip',
    detail: `Parsed ${parsedFiles} files within a 200-file/2MB bound; ${sources.skipped || parsedFiles !== sources.files.length ? 'some files were skipped. ' : ''}Static observations do not prove route mounting, provider ancestry, or runtime behavior.`,
  });
  if (application.role === 'backend' || application.role === 'fullstack') {
    checks.push({
      name: 'Server adapter',
      status: 'skip',
      detail: adapter
        ? 'An adapter import was found; verify its route mounts at the client endpoint.'
        : 'No direct adapter import found; inspect custom/re-exported routes using installed adapter references.',
    });
  }
  if (application.role === 'frontend' || application.role === 'fullstack') {
    checks.push({
      name: 'React provider',
      status: 'skip',
      detail: provider
        ? 'EdgeStoreProvider JSX was found; verify it wraps the upload UI.'
        : 'No directly named EdgeStoreProvider JSX found; inspect custom wrappers and provider aliases.',
    });
  }
  if (application.framework === 'hono')
    checks.push({
      name: 'Environment loading',
      status: 'skip',
      detail:
        'Hono does not itself establish the Node env-file loader. Check the actual start script loads the selected backend env file.',
    });
  checks.push({
    name: 'Remote bucket mapping',
    status: 'skip',
    detail:
      'Router/provider mapping was not executed or inferred. Compare actual bucket names during the application upload test.',
  });
  return checks;
}

export function inspectSource(source: string, frontend: boolean) {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, {
      sourceType: 'unambiguous',
      plugins: ['typescript', 'jsx'],
      attachComment: false,
    });
  } catch {
    return undefined;
  }
  const warnings = new Set<string>();
  let adapter = false;
  let provider = false;
  const corsNames = new Set<string>();
  const handlers = new Set<string>();
  const clientFile =
    frontend ||
    ast.program.directives.some(
      (directive) => directive.value.value === 'use client',
    );
  for (const statement of ast.program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    const from = statement.source.value;
    const typeOnly =
      statement.importKind === 'type' ||
      (statement.specifiers.length > 0 &&
        statement.specifiers.every(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            specifier.importKind === 'type',
        ));
    if (from.startsWith('@edgestore/server/adapters/') && !typeOnly) {
      adapter = true;
      for (const specifier of statement.specifiers)
        handlers.add(specifier.local.name);
    }
    if (from === 'hono/cors') {
      for (const specifier of statement.specifiers)
        corsNames.add(specifier.local.name);
    }
    if (
      clientFile &&
      !typeOnly &&
      (from.startsWith('@edgestore/server') ||
        statement.specifiers.some(
          (specifier) =>
            specifier.type === 'ImportSpecifier' &&
            isIdentifier(specifier.imported, { name: 'EdgeStoreRouter' }) &&
            specifier.importKind !== 'type',
        ))
    ) {
      warnings.add(
        'Possible server runtime import in a client module. Use an import type for the backend router contract; do not bundle server modules.',
      );
    }
  }
  traverseFast(ast, (node) => {
    if (
      node.type === 'JSXOpeningElement' &&
      node.name.type === 'JSXIdentifier' &&
      node.name.name === 'EdgeStoreProvider'
    )
      provider = true;
    if (
      node.type !== 'CallExpression' ||
      !isIdentifier(node.callee) ||
      node.arguments[0]?.type !== 'ObjectExpression'
    )
      return;
    const argument = node.arguments[0];
    if (
      handlers.has(node.callee.name) &&
      property(argument, 'router') &&
      !property(argument, 'edgestore')
    ) {
      warnings.add(
        'Direct handler router option resembles 0.2 wiring. Check the installed version before maintaining or migrating it.',
      );
    }
    if (corsNames.has(node.callee.name)) {
      const origin = property(argument, 'origin');
      const credentials = property(argument, 'credentials');
      const reflects =
        origin?.type === 'ArrowFunctionExpression' &&
        origin.params.length === 1 &&
        isIdentifier(origin.params[0]) &&
        isIdentifier(origin.body, { name: origin.params[0].name });
      if (
        credentials?.type === 'BooleanLiteral' &&
        credentials.value &&
        (isStringLiteral(origin, { value: '*' }) || reflects)
      )
        warnings.add(
          'Credentialed CORS uses a wildcard or reflected origin. Configure an explicit trusted frontend origin for the EdgeStore route.',
        );
    }
  });
  return { adapter, provider, warnings: [...warnings] };
}

function property(object: ObjectExpression, name: string) {
  const member = object.properties.find(
    (entry) =>
      isObjectProperty(entry) &&
      !entry.computed &&
      (isIdentifier(entry.key, { name }) ||
        isStringLiteral(entry.key, { value: name })),
  );
  return isObjectProperty(member) ? member.value : undefined;
}

async function readSources(directory: string) {
  const files: { name: string; text: string }[] = [];
  let bytes = 0;
  let skipped = false;
  let inspectedEntries = 0;
  const queue = [directory];
  const ignored = new Set([
    'node_modules',
    'dist',
    'build',
    'coverage',
    'public',
    'test',
    'tests',
    '__tests__',
  ]);
  while (
    queue.length &&
    files.length < 200 &&
    bytes < 2_000_000 &&
    inspectedEntries < 2_000
  ) {
    const current = queue.shift()!;
    const entries = await readdir(current, { withFileTypes: true }).catch(
      () => [],
    );
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (++inspectedEntries > 2_000) {
        skipped = true;
        break;
      }
      if (
        entry.isSymbolicLink() ||
        entry.name.startsWith('.') ||
        ignored.has(entry.name)
      )
        continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Do not inspect another workspace's source under a monorepo root.
        if (
          await stat(path.join(file, 'package.json')).then(
            () => true,
            () => false,
          )
        )
          continue;
        if (path.relative(directory, file).split(path.sep).length < 10)
          queue.push(file);
        continue;
      }
      if (
        !/\.[cm]?[jt]sx?$/.test(entry.name) ||
        /\.(test|spec)\./.test(entry.name) ||
        entry.name.endsWith('.d.ts')
      )
        continue;
      if (files.length >= 200) {
        skipped = true;
        break;
      }
      try {
        const size = (await stat(file)).size;
        if (size > 128_000 || bytes + size > 2_000_000) {
          skipped = true;
          continue;
        }
        await validatePath(file, directory);
        files.push({
          name: path.relative(directory, file),
          text: await readFile(file, 'utf8'),
        });
        bytes += size;
      } catch {
        skipped = true;
      }
    }
  }
  return { files, skipped: skipped || queue.length > 0 };
}
