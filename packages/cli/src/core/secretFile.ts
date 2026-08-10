import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { findGitRoot } from './config';
import { CliError, usageError } from './errors';
import type { CliRuntime } from './runtime';

const execFileAsync = promisify(execFile);

export async function resolveSecretOutput(
  runtime: CliRuntime,
  explicitOutput: string | undefined,
  interactive: boolean,
): Promise<string> {
  if (explicitOutput) return explicitOutput;
  if (!interactive) return '.env.local';

  const discovered = (
    await readdir(runtime.workspaceCwd, { withFileTypes: true })
  )
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith('.env') &&
        !/\.(?:example|sample|template)$/i.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
  if (!discovered.length || discovered.every((name) => name === '.env.local')) {
    return '.env.local';
  }
  const choices = Array.from(new Set([...discovered, '.env.local']));
  return runtime.prompts.select(
    'Where should EdgeStore save the project key?',
    choices.map((value) => ({ value, label: value })),
  );
}

export function projectKeyName(output: string | undefined): string {
  const match = /^\.env\.([^.]+)(?:\.local)?$/i.exec(
    path.basename(output ?? ''),
  );
  return match?.[1] && match[1].toLowerCase() !== 'local' ? match[1] : 'local';
}

export async function protectSecretFile(
  cwd: string,
  output: string,
): Promise<string> {
  const absolute = path.resolve(cwd, output);
  const gitRoot = await findGitRoot(cwd);
  const packageRoot = path.resolve(cwd);
  const boundary = gitRoot ?? packageRoot;
  const repositoryRelative = path.relative(boundary, absolute);
  const packageRelative = path.relative(packageRoot, absolute);
  if (
    !packageRelative ||
    packageRelative.startsWith('..') ||
    path.isAbsolute(packageRelative)
  ) {
    throw usageError(
      'secret_output_unprotected',
      `Secret output ${absolute} must be inside ${packageRoot}.`,
      ['Choose an env file inside the selected package.'],
    );
  }
  const normalized = packageRelative.replaceAll(path.sep, '/');
  const gitPath = repositoryRelative.replaceAll(path.sep, '/');
  if (gitRoot) {
    if (await isTrackedFile(gitRoot, gitPath)) {
      throw usageError(
        'secret_output_tracked',
        `Secret output ${absolute} is already tracked by Git.`,
        ['Remove it from Git before creating a project key.'],
      );
    }
    if (await isIgnoredFile(gitRoot, gitPath)) return normalized;
  }

  const gitignorePath = path.join(packageRoot, '.gitignore');
  let contents = '';
  try {
    contents = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const entry = `/${normalized}`;
  const next = `${contents}${contents ? (contents.endsWith('\n') ? '' : '\n') : ''}${entry}\n`;
  try {
    await writeFile(gitignorePath, next);
  } catch (error) {
    throw new CliError(
      'secret_output_unprotected',
      `Could not protect secret output ${absolute}.`,
      {
        details: {
          path: gitignorePath,
          cause: error instanceof Error ? error.message : String(error),
        },
      },
    );
  }
  if (gitRoot && !(await isIgnoredFile(gitRoot, gitPath))) {
    throw new CliError(
      'secret_output_unprotected',
      `Could not protect secret output ${absolute}.`,
    );
  }
  return normalized;
}

async function isIgnoredFile(root: string, relative: string): Promise<boolean> {
  try {
    await execFileAsync('git', [
      '-C',
      root,
      'check-ignore',
      '--quiet',
      '--no-index',
      '--',
      relative,
    ]);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 1) {
      return false;
    }
    throw new CliError(
      'secret_output_unprotected',
      `Could not verify Git ignore rules for ${path.join(root, relative)}.`,
      {
        details: {
          path: path.join(root, relative),
          cause: error instanceof Error ? error.message : String(error),
        },
      },
    );
  }
}

async function isTrackedFile(root: string, relative: string): Promise<boolean> {
  try {
    await execFileAsync('git', [
      '-C',
      root,
      'ls-files',
      '--error-unmatch',
      '--',
      relative,
    ]);
    return true;
  } catch (error) {
    if ((error as { code?: unknown }).code === 1) {
      return false;
    }
    throw new CliError(
      'secret_output_unprotected',
      `Could not verify Git tracking for ${path.join(root, relative)}.`,
      {
        details: {
          path: path.join(root, relative),
          cause: error instanceof Error ? error.message : String(error),
        },
      },
    );
  }
}
