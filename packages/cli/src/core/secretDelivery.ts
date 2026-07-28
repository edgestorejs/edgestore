import { spawn } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CliError, usageError } from './errors';

export type SecretDeliveryOptions = {
  copy?: boolean;
  output?: string;
  update?: boolean;
};

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
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const names = Object.keys(values);
  const present = names.filter((name) =>
    new RegExp(`^${escapeRegExp(name)}=`, 'm').test(existing),
  );
  if (present.length && !update) {
    throw usageError(
      'secret_output_exists',
      `${filePath} already contains ${present.join(', ')}.`,
      ['Pass --update to replace the existing values.'],
    );
  }

  let next = existing;
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${escapeRegExp(name)}=.*$`, 'm');
    next = pattern.test(next)
      ? next.replace(pattern, line)
      : `${next}${next && !next.endsWith('\n') ? '\n' : ''}${line}\n`;
  }
  await writeFile(filePath, next, { mode: 0o600 });
  await chmod(filePath, 0o600);
}

async function copyToClipboard(value: string): Promise<void> {
  const candidates =
    process.platform === 'darwin'
      ? [['pbcopy']]
      : process.platform === 'win32'
        ? [['clip']]
        : [['wl-copy'], ['xclip', '-selection', 'clipboard']];

  for (const [command, ...args] of candidates) {
    if (!command) continue;
    const copied = await runClipboard(command, args, value);
    if (copied) return;
  }
  throw new CliError(
    'clipboard_unavailable',
    'No supported clipboard command is available.',
  );
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
