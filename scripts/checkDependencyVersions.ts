import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

type DependencyField = (typeof dependencyFields)[number];

type PackageJson = {
  [TField in DependencyField]?: Record<string, string>;
};

type WorkspaceConfig = {
  catalog?: Record<string, string>;
};

// Key exceptions as "examples/<name>:<dependency>" and explain why the
// example intentionally tests a different version than the default catalog.
const catalogExceptions = new Map<string, string>();

function isExactVersion(specifier: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[\d.A-Za-z-]+)?(?:\+[\d.A-Za-z-]+)?$/.test(
    specifier,
  );
}

function isExactPackageSpecifier(specifier: string): boolean {
  if (isExactVersion(specifier)) return true;

  const aliasVersion = /^npm:(?:@[^/]+\/)?[^@]+@(.+)$/.exec(specifier)?.[1];
  return aliasVersion !== undefined && isExactVersion(aliasVersion);
}

async function main() {
  const workspaceText = await readFile(
    path.join(repoRoot, 'pnpm-workspace.yaml'),
    'utf8',
  );
  const workspace = parse(workspaceText) as WorkspaceConfig;
  const catalog = workspace.catalog ?? {};
  const errors: string[] = [];

  for (const [name, version] of Object.entries(catalog)) {
    if (!isExactVersion(version)) {
      errors.push(
        `catalog.${name} must be an exact version, found "${version}"`,
      );
    }
  }

  const examplesDir = path.join(repoRoot, 'examples');
  const entries = await readdir(examplesDir, { withFileTypes: true });
  const usedExceptions = new Set<string>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const examplePath = `examples/${entry.name}`;
    const manifestPath = path.join(repoRoot, examplePath, 'package.json');
    const manifest = JSON.parse(
      await readFile(manifestPath, 'utf8'),
    ) as PackageJson;

    for (const field of dependencyFields) {
      for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
        if (
          specifier.startsWith('catalog:') ||
          specifier.startsWith('workspace:')
        ) {
          errors.push(
            `${examplePath} ${field}.${name} must remain standalone, found "${specifier}"`,
          );
          continue;
        }

        if (name.startsWith('@edgestore/')) {
          if (!specifier.startsWith('^')) {
            errors.push(
              `${examplePath} ${field}.${name} must reference a published compatibility range, found "${specifier}"`,
            );
          }
          continue;
        }

        if (!isExactPackageSpecifier(specifier)) {
          errors.push(
            `${examplePath} ${field}.${name} must use an exact version, found "${specifier}"`,
          );
          continue;
        }

        const catalogVersion = catalog[name];
        if (catalogVersion === undefined || specifier === catalogVersion) {
          continue;
        }

        const exceptionKey = `${examplePath}:${name}`;
        const exceptionReason = catalogExceptions.get(exceptionKey);
        if (exceptionReason) {
          usedExceptions.add(exceptionKey);
          continue;
        }

        errors.push(
          `${examplePath} ${field}.${name} is "${specifier}", expected catalog version "${catalogVersion}"`,
        );
      }
    }
  }

  for (const [exceptionKey, reason] of catalogExceptions) {
    if (!reason.trim()) {
      errors.push(`${exceptionKey} must include an exception reason`);
    } else if (!usedExceptions.has(exceptionKey)) {
      errors.push(`${exceptionKey} is an unused catalog exception`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Dependency version policy violations:\n${errors
        .map((error) => `- ${error}`)
        .join('\n')}`,
    );
    process.exit(1);
  }

  console.log('Dependency versions follow the workspace policy.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
