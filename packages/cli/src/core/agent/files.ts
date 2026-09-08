import { createHash, randomUUID } from 'node:crypto';
import {
  lstat,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { CliError, usageError } from '../errors';

export type FileChange = {
  file: string;
  root: string;
  before: string | undefined;
  after: string;
};

export function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// Reject symlinks below the explicitly selected root, including dangling ones.
export async function validatePath(file: string, root: string): Promise<void> {
  const relative = path.relative(root, file);
  if (
    !relative ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    throw usageError(
      'unsafe_agent_path',
      'Agent asset path is outside its selected root.',
    );
  }
  let current = root;
  for (const part of ['', ...relative.split(path.sep)]) {
    current = path.join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw usageError(
          'unsafe_agent_path',
          'Refusing to follow a symlink in an agent asset path.',
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

export async function readOptional(
  file: string,
  root: string,
): Promise<string | undefined> {
  await validatePath(file, root);
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new CliError(
      'agent_file_unreadable',
      'Could not read an agent configuration file.',
      { details: { file } },
    );
  }
}

export async function applyChanges(changes: FileChange[]): Promise<void> {
  for (const change of changes) await checkUnchanged(change);
  const applied: string[] = [];
  try {
    for (const change of changes) {
      await mkdir(path.dirname(change.file), { recursive: true });
      await checkUnchanged(change);
      const temporary = `${change.file}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, change.after, { flag: 'wx', mode: 0o600 });
        await rename(temporary, change.file);
        applied.push(change.file);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    }
  } catch {
    // Underlying errors or file contents can contain credentials. Return only paths.
    throw new CliError(
      'agent_write_failed',
      'Agent configuration was not fully applied. Inspect the listed files before retrying.',
      { details: { applied } },
    );
  }
}

async function checkUnchanged(change: FileChange): Promise<void> {
  if ((await readOptional(change.file, change.root)) !== change.before) {
    throw usageError(
      'agent_file_changed',
      'An agent configuration file changed after inspection; retry the command.',
    );
  }
}
