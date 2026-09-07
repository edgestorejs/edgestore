import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import { z } from 'zod';
import { applicationKind } from './applicationKind';
import { findGitRoot } from './config';
import { usageError } from './errors';
import { detectPackageManager } from './packageInstall';
import { findWorkspaceRoot } from './workspace';

const manifestSchema = z.object({
  name: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});
const installedSchema = z.object({ name: z.string(), version: z.string() });
const packageNames = [
  '@edgestore/server',
  '@edgestore/react',
  '@edgestore/sdk',
] as const;

export { applicationKind } from './applicationKind';

export async function inspectApplication(directory: string) {
  const manifestPath = path.join(directory, 'package.json');
  let manifest: z.infer<typeof manifestSchema>;
  try {
    manifest = manifestSchema.parse(
      JSON.parse(await readFile(manifestPath, 'utf8')),
    );
  } catch {
    // Never include arbitrary manifest contents or parser snippets in agent output.
    throw usageError(
      'invalid_package_manifest',
      `Could not read a valid package manifest at ${manifestPath}.`,
    );
  }
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const workspaceRoot = await findWorkspaceRoot(directory);
  const candidates =
    workspaceRoot === directory
      ? (await getPackages(directory)).packages
          .filter((pkg) => pkg.dir !== directory)
          .map((pkg) => ({ directory: pkg.dir, name: pkg.packageJson.name }))
      : [];
  const packages = await Promise.all(
    packageNames.map((name) =>
      inspectPackage(directory, name, dependencies[name]),
    ),
  );
  const versions = packages.flatMap((pkg) =>
    pkg.version ? [pkg.version] : [],
  );
  const families = new Set(versions.map(versionFamily));
  const compatibility =
    families.size > 1 ? 'mixed' : ([...families][0] ?? 'not-installed');
  const warnings: string[] = [];
  if (compatibility === 'legacy')
    warnings.push(
      'Choose whether to maintain 0.2 or migrate before changing APIs. Do not upgrade implicitly.',
    );
  if (compatibility === 'mixed' || compatibility === 'unsupported')
    warnings.push(
      'Resolve package compatibility explicitly before implementing; do not mix API generations.',
    );
  if (new Set(versions).size > 1)
    warnings.push(
      'Installed EdgeStore package versions differ. Read each package’s own references and verify compatibility.',
    );
  const files = (await readdir(directory)).filter((name) =>
    /^\.env(?:\.[\w.-]+)?$/.test(name),
  );
  const environmentFiles = [];
  for (const name of files.sort()) {
    if ((await stat(path.join(directory, name))).isFile())
      environmentFiles.push(path.join(directory, name));
  }
  return {
    directory,
    name: manifest.name,
    ...applicationKind(dependencies),
    packageManager: await detectPackageManager(directory),
    workspaceRoot,
    candidateWorkspaces: candidates,
    packages,
    compatibility,
    warnings,
    environmentFiles,
  };
}

export function versionFamily(
  version: string,
): 'v1' | 'legacy' | 'unsupported' {
  if (/^1\.\d+\.\d+(?:[-+].*)?$/.test(version)) return 'v1';
  if (/^0\.2\.\d+(?:[-+].*)?$/.test(version)) return 'legacy';
  return 'unsupported';
}

async function inspectPackage(
  directory: string,
  name: string,
  declaredVersion: string | undefined,
) {
  const base = { name, declaredVersion };
  if (!declaredVersion)
    return { ...base, version: undefined, status: 'not-declared' as const };
  let manifestPath: string;
  try {
    manifestPath = await resolveApplicationPackage(directory, name);
  } catch {
    return { ...base, version: undefined, status: 'not-resolved' as const };
  }
  let installed: z.infer<typeof installedSchema>;
  try {
    installed = installedSchema.parse(
      JSON.parse(await readFile(manifestPath, 'utf8')),
    );
    if (installed.name !== name) throw new Error('Package name mismatch');
  } catch {
    throw usageError(
      'invalid_installed_package',
      `Invalid installed metadata for ${name}.`,
    );
  }
  const { version } = installed;
  const root = path.dirname(manifestPath);
  const docsPath = path.join(root, 'agent-docs/README.md');
  let bundled = false;
  try {
    const header = (await readFile(docsPath, 'utf8')).split('\n')[0];
    bundled = header === `# ${name} ${version}: agent references`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const family = versionFamily(version);
  const docs = bundled
    ? { kind: 'bundled' as const, path: docsPath, version }
    : {
        kind: 'online-fallback' as const,
        version,
        // Update the 0.2 URL to its archive as part of stable v1 docs promotion.
        url:
          family === 'legacy'
            ? 'https://edgestore.dev/docs/quick-start'
            : family === 'v1'
              ? `${version.includes('-') ? 'https://next.edgestore.dev' : 'https://edgestore.dev'}/docs/agents`
              : undefined,
        warning:
          'No matching bundled references found. Online guidance may differ from this installed version; inspect installed types before using it.',
      };
  return { ...base, status: 'installed' as const, version, root, docs };
}

async function resolveApplicationPackage(
  directory: string,
  name: string,
): Promise<string> {
  const boundary =
    (await findWorkspaceRoot(directory)) ??
    (await findGitRoot(directory)) ??
    directory;
  let current = directory;
  while (true) {
    try {
      // Follow package-manager symlinks, but never fall back to NODE_PATH or
      // a global CLI's modules when the app has not installed its dependency.
      return await realpath(
        path.join(current, 'node_modules', name, 'package.json'),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (current === boundary || path.dirname(current) === current) break;
    current = path.dirname(current);
  }
  throw new Error(`Package not installed in the selected application: ${name}`);
}
