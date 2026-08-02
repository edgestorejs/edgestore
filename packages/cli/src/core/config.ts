import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { CliError } from './errors';

const globalConfigSchema = z
  .object({
    version: z.literal(1),
    activeAccount: z.string().min(1).optional(),
  })
  .strict();

const repoConfigSchema = z
  .object({
    account: z.string().min(1),
    project: z.string().min(1),
  })
  .strict();

export type GlobalConfig = z.infer<typeof globalConfigSchema>;
export type RepoConfig = z.infer<typeof repoConfigSchema>;

export type LocatedRepoConfig = {
  config: RepoConfig;
  path: string;
};

export class GlobalConfigStore {
  constructor(readonly path: string) {}

  async read(): Promise<GlobalConfig> {
    return readConfig(this.path, globalConfigSchema, { version: 1 });
  }

  async write(config: GlobalConfig): Promise<void> {
    await writeConfig(this.path, globalConfigSchema.parse(config));
  }
}

export class RepoConfigStore {
  constructor(private readonly cwd: string) {}

  async read(): Promise<LocatedRepoConfig | undefined> {
    const configPath = await findRepoConfig(this.cwd);
    if (!configPath) {
      return undefined;
    }

    return {
      config: await readConfig(configPath, repoConfigSchema),
      path: configPath,
    };
  }

  async write(config: RepoConfig): Promise<string> {
    const root = (await findGitRoot(this.cwd)) ?? this.cwd;
    const configPath = path.join(root, '.edgestore', 'config.json');
    await writeConfig(configPath, repoConfigSchema.parse(config));
    return configPath;
  }

  async remove(): Promise<string | undefined> {
    const located = await this.read();
    if (!located) {
      return undefined;
    }

    await rm(located.path);
    await rmdir(path.dirname(located.path)).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST') {
          throw error;
        }
      },
    );
    return located.path;
  }
}

async function readConfig<TConfig>(
  configPath: string,
  schema: z.ZodType<TConfig>,
  missingValue?: TConfig,
): Promise<TConfig> {
  let contents: string;
  try {
    contents = await readFile(configPath, 'utf8');
  } catch (error) {
    if (isMissingFile(error) && missingValue !== undefined) {
      return missingValue;
    }
    throw error;
  }

  try {
    return schema.parse(JSON.parse(contents));
  } catch (error) {
    throw new CliError(
      'invalid_config',
      `Invalid EdgeStore config at ${configPath}.`,
      { details: error },
    );
  }
}

async function writeConfig<TConfig>(
  configPath: string,
  config: TConfig,
): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  const temporaryPath = `${configPath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporaryPath, configPath);
}

async function findRepoConfig(start: string): Promise<string | undefined> {
  let current = path.resolve(start);
  const gitRoot = await findGitRoot(current);

  if (!gitRoot) {
    const candidate = path.join(current, '.edgestore', 'config.json');
    return (await pathExists(candidate)) ? candidate : undefined;
  }

  while (true) {
    const candidate = path.join(current, '.edgestore', 'config.json');
    if (await pathExists(candidate)) {
      return candidate;
    }

    if (current === gitRoot) {
      return undefined;
    }
    current = path.dirname(current);
  }
}

async function findGitRoot(start: string): Promise<string | undefined> {
  let current = path.resolve(start);

  while (true) {
    if (await pathExists(path.join(current, '.git'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }
    current = parent;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await stat(candidate);
    return true;
  } catch (error) {
    if (isMissingFile(error)) {
      return false;
    }
    throw error;
  }
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}
