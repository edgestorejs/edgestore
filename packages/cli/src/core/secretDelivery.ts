import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  access,
  chmod,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { CliError, usageError } from './errors';

export type SecretDeliveryOptions = {
  copy?: boolean;
  output?: string;
  update?: boolean;
};

export async function preflightEnvSecret(
  cwd: string,
  names: string[],
  options: SecretDeliveryOptions,
): Promise<void> {
  if (options.copy) {
    await resolveClipboardCommand();
  }
  if (options.output) {
    const outputPath = path.resolve(cwd, options.output);
    const existing = await readEnvFile(outputPath);
    assertAssignmentsAvailable({
      filePath: outputPath,
      contents: existing.contents,
      names,
      update: Boolean(options.update),
    });
    const directoryMode =
      constants.W_OK | (process.platform === 'win32' ? 0 : constants.X_OK);
    await access(path.dirname(outputPath), directoryMode);
    if (existing.exists) await access(outputPath, constants.W_OK);
  }
}

export async function deliverEnvSecret(
  cwd: string,
  values: Record<string, string>,
  options: SecretDeliveryOptions,
): Promise<string[]> {
  const text = Object.entries(values)
    .map(([name, value]) => `${name}=${value}`)
    .join('\n');
  const destinations: string[] = [];

  if (options.copy) {
    await copyToClipboard(`${text}\n`);
    destinations.push('Copied to clipboard.');
  }
  if (options.output) {
    const outputPath = path.resolve(cwd, options.output);
    await writeEnvFile(outputPath, values, Boolean(options.update));
    destinations.push(`Saved to ${outputPath}.`);
  }
  return destinations;
}

async function writeEnvFile(
  filePath: string,
  values: Record<string, string>,
  update: boolean,
): Promise<void> {
  const existing = await readEnvFile(filePath);

  const names = Object.keys(values);
  assertAssignmentsAvailable({
    filePath,
    contents: existing.contents,
    names,
    update,
  });
  const next = updateAssignments(existing.contents, values);
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporaryPath, next, { mode: 0o600 });
    await chmod(temporaryPath, 0o600);
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function copyToClipboard(value: string): Promise<void> {
  const [command, ...args] = await resolveClipboardCommand();
  const copied = await runClipboard(command, args, value);
  if (copied) return;
  throw new CliError('clipboard_failed', 'Could not copy to the clipboard.');
}

async function resolveClipboardCommand(): Promise<[string, ...string[]]> {
  for (const candidate of clipboardCandidates()) {
    if (await executableExists(candidate[0])) return candidate;
  }
  throw new CliError(
    'clipboard_unavailable',
    'No supported clipboard command is available.',
  );
}

function clipboardCandidates(): [string, ...string[]][] {
  return process.platform === 'darwin'
    ? [['pbcopy']]
    : process.platform === 'win32'
      ? [['clip']]
      : [['wl-copy'], ['xclip', '-selection', 'clipboard']];
}

async function executableExists(command: string | undefined): Promise<boolean> {
  if (!command) return false;
  // Clipboard helpers are native executables, so detection must inspect PATH.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const executableExtensions = process.env.PATHEXT;
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const executablePath = process.env.PATH;
  const extensions =
    process.platform === 'win32'
      ? (executableExtensions ?? '.EXE;.CMD;.BAT;.COM').split(';')
      : [''];
  for (const directory of (executablePath ?? '').split(path.delimiter)) {
    for (const extension of extensions) {
      try {
        await access(
          path.join(directory, `${command}${extension}`),
          process.platform === 'win32' ? constants.F_OK : constants.X_OK,
        );
        return true;
      } catch {
        // Keep searching PATH.
      }
    }
  }
  return false;
}

function runClipboard(
  command: string,
  args: string[],
  value: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') resolve(false);
      else reject(error);
    });
    child.on('exit', (code) => {
      resolve(code === 0);
    });
    child.stdin.end(value);
  });
}

async function readEnvFile(
  filePath: string,
): Promise<{ contents: string; exists: boolean }> {
  try {
    return { contents: await readFile(filePath, 'utf8'), exists: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { contents: '', exists: false };
    }
    throw error;
  }
}

function assertAssignmentsAvailable(input: {
  filePath: string;
  contents: string;
  names: string[];
  update: boolean;
}): void {
  const present = input.names.filter((name) =>
    hasAssignment(input.contents, name),
  );
  if (present.length && !input.update) {
    throw usageError(
      'secret_output_exists',
      `${input.filePath} already contains ${present.join(', ')}.`,
      ['Pass --update to replace the existing values.'],
    );
  }
}

function hasAssignment(contents: string, name: string): boolean {
  return contents
    .split('\n')
    .some((line) => line.replace(/\r$/, '').startsWith(`${name}=`));
}

function updateAssignments(
  contents: string,
  values: Record<string, string>,
): string {
  const replaced = new Set<string>();
  const lines = contents.split('\n').map((line) => {
    const carriageReturn = line.endsWith('\r') ? '\r' : '';
    const content = carriageReturn ? line.slice(0, -1) : line;
    for (const [name, value] of Object.entries(values)) {
      if (content.startsWith(`${name}=`)) {
        replaced.add(name);
        return `${name}=${value}${carriageReturn}`;
      }
    }
    return line;
  });
  let next = lines.join('\n');
  for (const [name, value] of Object.entries(values)) {
    if (replaced.has(name)) continue;
    if (next && !next.endsWith('\n')) next += '\n';
    next += `${name}=${value}\n`;
  }
  return next;
}
