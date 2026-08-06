import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { getPackages } from '@manypkg/get-packages';
import { findGitRoot, findPackageRoot } from './config';
import { usageError } from './errors';
import type { CliRuntime, GlobalFlags } from './runtime';

type ContextPurpose = 'read' | 'write';

export async function resolveWorkingDirectory(
  current: string,
  requested: string,
): Promise<string> {
  const resolved = path.resolve(current, requested);
  try {
    if ((await stat(resolved)).isDirectory()) return resolved;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  throw usageError(
    'working_directory_not_found',
    `Working directory does not exist: ${resolved}.`,
  );
}

export async function selectWorkspaceContext(
  runtime: CliRuntime,
  flags: GlobalFlags,
  purpose: ContextPurpose,
): Promise<void> {
  if (flags.cwd) return;

  const selected = await selectWorkspaceDirectory(runtime, flags, purpose);
  if (selected !== runtime.cwd) runtime.setCwd(selected);
}

export async function isWorkspaceRoot(directory: string): Promise<boolean> {
  if (await exists(path.join(directory, 'pnpm-workspace.yaml'))) return true;
  try {
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'package.json'), 'utf8'),
    ) as { workspaces?: unknown };
    return Array.isArray(manifest.workspaces) || Boolean(manifest.workspaces);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function selectWorkspaceDirectory(
  runtime: CliRuntime,
  flags: GlobalFlags,
  purpose: ContextPurpose,
): Promise<string> {
  const start = path.resolve(runtime.cwd);
  const gitRoot = await findGitRoot(start);
  const packageRoot = await findPackageRoot(start);
  if (!gitRoot || start !== gitRoot) return packageRoot;
  if (!(await isWorkspaceRoot(gitRoot))) return packageRoot;

  const packages = await discoverPackageDirectories(gitRoot);
  const configured = [];
  for (const directory of [gitRoot, ...packages]) {
    if (await exists(path.join(directory, '.edgestore', 'config.json'))) {
      configured.push(directory);
    }
  }

  if (configured.includes(gitRoot)) return gitRoot;
  if (configured.length === 1) return configured[0]!;
  if (configured.length > 1) {
    return chooseWorkspace(runtime, flags, {
      directories: configured,
      kind: 'configured',
    });
  }
  if (purpose === 'read') return gitRoot;
  if (packages.length === 1) return packages[0]!;
  if (packages.length > 1) {
    return chooseWorkspace(runtime, flags, {
      directories: packages,
      kind: 'available',
    });
  }
  return gitRoot;
}

async function chooseWorkspace(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    directories: string[];
    kind: 'configured' | 'available';
  },
): Promise<string> {
  const interactive = runtime.io.inputIsTty && !flags.json && !flags.plain;
  if (!interactive) {
    throw usageError(
      'workspace_context_required',
      `Multiple ${input.kind} workspaces were found.`,
      ['Pass --cwd <directory> to select a workspace package.'],
    );
  }

  return runtime.prompts.select(
    'Which workspace package should EdgeStore use?',
    await Promise.all(
      input.directories.map(async (directory) => ({
        value: directory,
        label: await packageLabel(directory),
        hint: path.relative(runtime.cwd, directory) || '.',
      })),
    ),
  );
}

async function discoverPackageDirectories(root: string): Promise<string[]> {
  const workspace = await getPackages(root);
  return workspace.packages.map((workspacePackage) => workspacePackage.dir);
}

async function packageLabel(directory: string): Promise<string> {
  try {
    const manifest = JSON.parse(
      await readFile(path.join(directory, 'package.json'), 'utf8'),
    ) as { name?: unknown };
    if (typeof manifest.name === 'string' && manifest.name.trim()) {
      return manifest.name;
    }
  } catch {
    // Invalid manifests are reported by init before remote mutations.
  }
  return path.basename(directory);
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
