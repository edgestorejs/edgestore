import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');

const CHECK_MODE = process.argv.includes('--check');

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

async function readJson(filePath: string): Promise<PackageJson> {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

async function writeJsonIfChanged(
  filePath: string,
  nextObj: PackageJson,
): Promise<boolean> {
  const nextText = `${JSON.stringify(nextObj, null, 2)}\n`;
  const prevText = await readFile(filePath, 'utf8');
  if (prevText === nextText) return false;
  if (CHECK_MODE) return true;
  await writeFile(filePath, nextText, 'utf8');
  return true;
}

async function getLocalWorkspacePackageVersions(): Promise<
  Record<string, string>
> {
  const packagesDir = path.join(repoRoot, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true });

  const versionsByName: Record<string, string> = {};
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const pkgJsonPath = path.join(packagesDir, ent.name, 'package.json');
    try {
      const pkg = await readJson(pkgJsonPath);
      if (pkg?.name && pkg?.version) {
        versionsByName[pkg.name] = pkg.version;
      }
    } catch {
      // ignore folders without a package.json
    }
  }
  return versionsByName;
}

async function getStandaloneTargetManifests(): Promise<string[]> {
  const targets = [path.join(repoRoot, 'docs', 'package.json')];

  const examplesDir = path.join(repoRoot, 'examples');
  const entries = await readdir(examplesDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    targets.push(path.join(examplesDir, ent.name, 'package.json'));
  }

  return targets;
}

function updateDepsObject({
  deps,
  localVersions,
}: {
  deps: Record<string, string> | undefined;
  localVersions: Record<string, string>;
}): { changed: boolean; next: Record<string, string> | undefined } {
  if (!deps) return { changed: false, next: deps };

  let changed = false;
  const next = { ...deps };

  for (const [name, spec] of Object.entries(next)) {
    const local = localVersions[name];
    if (local) {
      // For @edgestore/* packages, update to match local version
      // Keep caret prefix for semver compatibility in apps
      const newSpec = `^${local}`;
      if (spec !== newSpec && spec !== local) {
        next[name] = newSpec;
        changed = true;
      }
    }
  }

  return { changed, next };
}

async function main() {
  const localVersions = await getLocalWorkspacePackageVersions();
  const targets = await getStandaloneTargetManifests();

  let anyChanges = false;
  const changedFiles: string[] = [];

  for (const manifestPath of targets) {
    let pkg: PackageJson;
    try {
      pkg = await readJson(manifestPath);
    } catch {
      // ignore missing manifests
      continue;
    }

    const d1 = updateDepsObject({
      deps: pkg.dependencies,
      localVersions,
    });
    const d2 = updateDepsObject({
      deps: pkg.devDependencies,
      localVersions,
    });
    const d3 = updateDepsObject({
      deps: pkg.peerDependencies,
      localVersions,
    });
    const d4 = updateDepsObject({
      deps: pkg.optionalDependencies,
      localVersions,
    });

    const nextPkg: PackageJson = {
      ...pkg,
      dependencies: d1.next,
      devDependencies: d2.next,
      peerDependencies: d3.next,
      optionalDependencies: d4.next,
    };

    const changed = d1.changed || d2.changed || d3.changed || d4.changed;
    if (!changed) continue;

    const didWriteOrWouldWrite = await writeJsonIfChanged(
      manifestPath,
      nextPkg,
    );
    if (didWriteOrWouldWrite) {
      anyChanges = true;
      changedFiles.push(path.relative(repoRoot, manifestPath));
    }
  }

  if (CHECK_MODE) {
    if (anyChanges) {
      console.error(
        `Standalone manifests are out of date:\n${changedFiles
          .map((p) => `- ${p}`)
          .join('\n')}\n\nRun: pnpm -s sync-versions`,
      );
      process.exit(1);
    }
    return;
  }

  if (changedFiles.length > 0) {
    console.log(
      `Updated versions in:\n${changedFiles.map((p) => `  - ${p}`).join('\n')}`,
    );
  }
}

main().catch((err: Error) => {
  console.error(err?.stack ?? String(err));
  process.exit(1);
});
