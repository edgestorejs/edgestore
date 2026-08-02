import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { detect } from 'package-manager-detector/detect';
import { renderCliCommand } from '../core/command';
import { findGitRoot } from '../core/config';
import { CliError, normalizeError, usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import {
  deliverEnvSecretWithRollback,
  preflightEnvSecret,
} from '../core/secretDelivery';
import { activeAccount } from './account';
import { parseBucketType } from './bucket';

type InitOptions = {
  new?: boolean;
  link?: string;
  name?: string;
  account?: string;
  createKey?: boolean;
  withoutKey?: boolean;
  output?: string;
  update?: boolean;
  bucket?: string;
  bucketType?: string;
  public?: boolean;
  protected?: boolean;
  install?: boolean;
  allowOverage?: boolean;
};

type BucketChoice = {
  name: string;
  type: 'file' | 'image';
  visibility: 'public' | 'protected';
};

type InitContext = {
  runtime: CliRuntime;
  sdk: ManagementEdgeStoreSdk;
  options: InitOptions;
  interactive: boolean;
  account: string;
};

export async function initCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: InitOptions,
): Promise<void> {
  const interactive = runtime.io.inputIsTty && !flags.json && !flags.plain;
  validateOptions(options, interactive);
  const sdk = await sdkFor(runtime, flags);
  const account = await resolveAccount({ runtime, sdk, options, interactive });
  const context = { runtime, sdk, options, interactive, account };
  const mode = await resolveMode(runtime, options, interactive);
  const createKey = await shouldCreateKey(context, mode);
  const secretOutput = createKey ? (options.output ?? '.env.local') : undefined;
  if (secretOutput) {
    await preflightEnvSecret(
      runtime.cwd,
      ['EDGE_STORE_ACCESS_KEY', 'EDGE_STORE_SECRET_KEY'],
      { output: secretOutput, update: options.update },
    );
  }

  const projectResult =
    mode === 'new'
      ? await createProject(context, createKey)
      : await selectProject(context);
  const keyResult =
    projectResult.projectKey ??
    (createKey
      ? await sdk.management.projectKeys.create({
          project: projectResult.project.basePath,
          name: 'local',
          signal: runtime.signal,
        })
      : undefined);

  if (keyResult && secretOutput) {
    const recoveryCommand = renderCliCommand(
      flags,
      initRecoveryArgs(options, projectResult.project.basePath, secretOutput),
    );
    try {
      await deliverEnvSecretWithRollback({
        cwd: runtime.cwd,
        values: {
          EDGE_STORE_ACCESS_KEY: keyResult.key.accessKey,
          EDGE_STORE_SECRET_KEY: keyResult.secretKey,
        },
        options: { output: secretOutput, update: options.update },
        credential: { label: 'project key', id: keyResult.key.id },
        rollback: async (signal) => {
          await sdk.management.projectKeys.revoke({
            project: projectResult.project.basePath,
            keyId: keyResult.key.id,
            signal,
          });
        },
        manualRollbackCommand: renderCliCommand(flags, [
          'project',
          'key',
          'revoke',
          projectResult.project.basePath,
          keyResult.key.id,
          '--yes',
        ]),
        recoverySuggestions: [recoveryCommand],
      });
    } catch (error) {
      const failure = normalizeError(error);
      if (mode !== 'new') throw failure;
      throw new CliError(
        failure.code,
        `${failure.message} Project ${projectResult.project.basePath} was preserved.`,
        {
          details: {
            delivery: failure.options.details,
            project: projectResult.project,
          },
          requestId: failure.options.requestId,
          suggestions: failure.options.suggestions,
          exitCode: failure.exitCode,
        },
      );
    }
  }

  const configPath = await runtime.repoConfig.write({
    account: projectResult.project.accountId,
    project: projectResult.project.basePath,
  });
  if (keyResult && secretOutput) {
    await ignoreSecretFile(runtime.cwd, secretOutput);
  }

  const bucketChoice = await resolveBucket(runtime, options, interactive);
  const bucket = bucketChoice
    ? (
        await sdk.management.buckets.create({
          project: projectResult.project.basePath,
          name: bucketChoice.name,
          type: bucketChoice.type,
          visibility: bucketChoice.visibility,
          signal: runtime.signal,
        })
      ).bucket
    : undefined;

  const packages = await detectPackages(runtime.cwd);
  const install = await installPackages(runtime, packages, {
    requested: options.install,
    interactive,
  });

  const human = [
    `Linked ${projectResult.project.name} (${projectResult.project.basePath}).`,
    `Config: ${configPath}`,
    ...(secretOutput
      ? [`Secrets: ${path.resolve(runtime.cwd, secretOutput)}`]
      : []),
    ...(bucket ? [`Bucket: ${bucket.name}`] : []),
    ...(install.command && !install.ran
      ? ['', 'Install packages:', `  ${install.command}`]
      : []),
    '',
    ...nextSteps(packages.framework),
  ].join('\n');
  outputFor(runtime, flags).result(
    {
      project: projectResult.project,
      key: keyResult?.key,
      bucket,
      configPath,
      output: secretOutput,
      install,
      framework: packages.framework,
    },
    human,
    projectResult.project.basePath,
  );
}

function validateOptions(options: InitOptions, interactive: boolean): void {
  if (options.new && options.link) {
    throw usageError('conflicting_init_mode', 'Choose either --new or --link.');
  }
  if (options.createKey && options.withoutKey) {
    throw usageError(
      'conflicting_key_options',
      'Choose either --create-key or --without-key.',
    );
  }
  if (options.output && options.withoutKey) {
    throw usageError(
      'conflicting_key_output',
      '--output cannot be used with --without-key.',
    );
  }
  if (options.public && options.protected) {
    throw usageError(
      'conflicting_bucket_visibility',
      'Choose either --public or --protected.',
    );
  }
  if (
    [options.bucketType, options.public, options.protected].some(Boolean) &&
    !options.bucket
  ) {
    throw usageError(
      'bucket_name_required',
      '--bucket is required with bucket options.',
    );
  }
  if (!options.bucket) return;
  validateBucketName(options.bucket);
  if (options.bucketType) parseBucketType(options.bucketType);
  if (!interactive) {
    parseBucketType(options.bucketType);
    if (![options.public, options.protected].some(Boolean)) {
      throw usageError(
        'bucket_visibility_required',
        'Choose --public or --protected when using --bucket.',
      );
    }
  }
}

async function resolveAccount(
  context: Omit<InitContext, 'account'>,
): Promise<string> {
  const { runtime, sdk, options, interactive } = context;
  if (options.account) return options.account;
  try {
    return await activeAccount(runtime);
  } catch (error) {
    if (!interactive) throw error;
  }
  const result = await sdk.management.accounts.list({ signal: runtime.signal });
  if (!result.accounts.length) {
    throw usageError('account_not_found', 'No accessible accounts found.');
  }
  const selected = await runtime.prompts.select(
    'Which account should own this project?',
    result.accounts.map((account) => ({
      value: account.id,
      label: account.displayName,
      hint: account.type.toLowerCase(),
    })),
  );
  const config = await runtime.globalConfig.read();
  await runtime.globalConfig.write({ ...config, activeAccount: selected });
  return selected;
}

async function resolveMode(
  runtime: CliRuntime,
  options: InitOptions,
  interactive: boolean,
): Promise<'new' | 'link'> {
  if (options.new) return 'new';
  if (options.link) return 'link';
  requireInteractive(interactive, 'Choose --new or --link <basePath>.');
  return runtime.prompts.select('What do you want to do?', [
    { value: 'new', label: 'Create a new project' },
    { value: 'link', label: 'Link an existing project' },
  ]);
}

async function createProject(context: InitContext, createKey: boolean) {
  const { runtime, sdk, options, interactive, account } = context;
  const name =
    options.name ??
    (await promptText(runtime, {
      interactive,
      message: 'Project name',
      placeholder: path.basename(runtime.cwd),
    }));
  return sdk.management.projects.create({
    account,
    name,
    createKey,
    allowOverage: Boolean(options.allowOverage),
    signal: runtime.signal,
  });
}

async function selectProject(context: InitContext) {
  const { runtime, sdk, options, interactive, account } = context;
  let projectRef = options.link;
  if (!projectRef) {
    requireInteractive(interactive, '--link requires a project base path.');
    const listed = await sdk.management.projects.list({
      account,
      signal: runtime.signal,
    });
    if (!listed.projects.length) {
      throw usageError(
        'project_not_found',
        'No projects are available in this account.',
        ['edgestore init --new --name <name>'],
      );
    }
    projectRef = await runtime.prompts.select(
      'Which project do you want to link?',
      listed.projects.map((project) => ({
        value: project.basePath,
        label: project.name,
        hint: project.basePath,
      })),
    );
  }
  const result = await sdk.management.projects.get({
    project: projectRef,
    signal: runtime.signal,
  });
  if (result.project.accountId !== account) {
    throw usageError(
      'project_account_mismatch',
      `Project ${result.project.basePath} does not belong to account ${account}.`,
    );
  }
  return { project: result.project, projectKey: undefined };
}

async function shouldCreateKey(
  context: InitContext,
  mode: 'new' | 'link',
): Promise<boolean> {
  const { runtime, options, interactive } = context;
  if (options.withoutKey) return false;
  if ([mode === 'new', options.createKey, options.output].some(Boolean)) {
    return true;
  }
  return interactive
    ? runtime.prompts.confirm('Create a new project key?', false)
    : false;
}

function initRecoveryArgs(
  options: InitOptions,
  project: string,
  output: string,
): string[] {
  return [
    'init',
    '--link',
    project,
    '--create-key',
    '--output',
    output,
    ...(options.update ? ['--update'] : []),
    ...(options.account ? ['--account', options.account] : []),
    ...(options.bucket ? ['--bucket', options.bucket] : []),
    ...(options.bucketType ? ['--bucket-type', options.bucketType] : []),
    ...(options.public ? ['--public'] : []),
    ...(options.protected ? ['--protected'] : []),
    ...(options.install ? ['--install'] : []),
  ];
}

async function resolveBucket(
  runtime: CliRuntime,
  options: InitOptions,
  interactive: boolean,
): Promise<BucketChoice | undefined> {
  let name = options.bucket;
  if (!name) {
    if (
      !interactive ||
      !(await runtime.prompts.confirm('Create a bucket now?'))
    ) {
      return undefined;
    }
    name = await runtime.prompts.text('Bucket name', 'publicFiles');
  }
  validateBucketName(name);
  const type = parseBucketType(
    options.bucketType ??
      (interactive
        ? await runtime.prompts.select('Bucket type', [
            { value: 'file', label: 'File' },
            { value: 'image', label: 'Image' },
          ])
        : undefined),
  );
  const visibility = [options.public, options.protected].some(Boolean)
    ? options.public
      ? 'public'
      : 'protected'
    : interactive
      ? await runtime.prompts.select('Visibility', [
          { value: 'public', label: 'Public' },
          { value: 'protected', label: 'Protected' },
        ])
      : undefined;
  if (!visibility) {
    throw usageError(
      'bucket_visibility_required',
      'Choose --public or --protected when using --bucket.',
    );
  }
  return { name, type, visibility };
}

export type PackagePlan = {
  framework: 'next' | 'react' | 'node' | 'unknown';
  manager?: 'pnpm' | 'npm' | 'yarn' | 'bun';
  missing: string[];
};

export async function detectPackages(cwd: string): Promise<PackagePlan> {
  const packagePath = path.join(cwd, 'package.json');
  let manifest: {
    packageManager?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  let contents: string;
  try {
    contents = await readFile(packagePath, 'utf8');
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw new CliError(
        'package_manifest_unreadable',
        `Could not read package manifest at ${packagePath}.`,
        {
          details: {
            path: packagePath,
            cause: error instanceof Error ? error.message : String(error),
          },
        },
      );
    }
    return {
      framework: 'unknown',
      manager: await detectPackageManager(cwd),
      missing: [],
    };
  }
  try {
    manifest = JSON.parse(contents) as typeof manifest;
  } catch (error) {
    throw new CliError(
      'invalid_package_manifest',
      `Invalid package manifest at ${packagePath}.`,
      {
        details: {
          path: packagePath,
          cause: error instanceof Error ? error.message : String(error),
        },
        exitCode: 2,
      },
    );
  }
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
  };
  const framework = dependencies.next
    ? 'next'
    : dependencies.react
      ? 'react'
      : 'node';
  const wanted =
    framework === 'next' || framework === 'react'
      ? ['@edgestore/server', '@edgestore/react', 'zod']
      : ['@edgestore/server', 'zod'];
  return {
    framework,
    manager: await detectPackageManager(cwd),
    missing: wanted.filter((name) => !dependencies[name]),
  };
}

async function installPackages(
  runtime: CliRuntime,
  plan: PackagePlan,
  options: {
    requested?: boolean;
    interactive: boolean;
  },
): Promise<{ command?: string; ran: boolean }> {
  if (!plan.manager || !plan.missing.length) return { ran: false };
  const args = installArgs(plan.manager, plan.missing);
  const command = [plan.manager, ...args].join(' ');
  const shouldInstall =
    options.requested ??
    (options.interactive
      ? await runtime.prompts.confirm(
          `Install EdgeStore packages with ${plan.manager}?`,
          true,
        )
      : false);
  if (!shouldInstall) return { command, ran: false };
  try {
    await runtime.runCommand(plan.manager, args, { cwd: runtime.cwd });
  } catch (error) {
    throw new CliError(
      'package_install_failed',
      error instanceof Error ? error.message : 'Package installation failed.',
      {
        suggestions: [command],
      },
    );
  }
  return { command, ran: true };
}

function isMissingPathError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

async function ignoreSecretFile(cwd: string, output: string): Promise<void> {
  const absolute = path.resolve(cwd, output);
  const relative = path.relative(cwd, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return;
  const gitignorePath = path.join(cwd, '.gitignore');
  let contents = '';
  try {
    contents = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const entry = relative.replaceAll(path.sep, '/');
  if (
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .includes(entry)
  ) {
    return;
  }
  await writeFile(
    gitignorePath,
    `${contents}${contents ? (contents.endsWith('\n') ? '' : '\n') : ''}${entry}\n`,
  );
}

function validateBucketName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/.test(name)) {
    throw usageError(
      'invalid_bucket_name',
      'Bucket names must begin with a letter or number and contain only letters, numbers, underscores, or hyphens.',
    );
  }
}

async function detectPackageManager(
  cwd: string,
): Promise<'pnpm' | 'npm' | 'yarn' | 'bun'> {
  const start = path.resolve(cwd);
  const boundary = (await findGitRoot(start)) ?? start;
  let directory = start;
  while (true) {
    for (const strategy of [
      'packageManager-field',
      'lockfile',
      'devEngines-field',
    ] as const) {
      const result = await detect({
        cwd: directory,
        stopDir: directory,
        strategies: [strategy],
        packageJsonParser: (contents) =>
          packageJsonForStrategy(contents, strategy),
      });
      if (
        result?.name === 'pnpm' ||
        result?.name === 'npm' ||
        result?.name === 'yarn' ||
        result?.name === 'bun'
      ) {
        return result.name;
      }
    }
    if (directory === boundary) break;
    directory = path.dirname(directory);
  }
  return 'npm';
}

function packageJsonForStrategy(
  contents: string,
  strategy: 'packageManager-field' | 'lockfile' | 'devEngines-field',
): Record<string, unknown> {
  const manifest = JSON.parse(contents) as Record<string, unknown>;
  if (strategy !== 'packageManager-field') delete manifest.packageManager;
  if (strategy !== 'devEngines-field') delete manifest.devEngines;
  return manifest;
}

function installArgs(
  manager: 'pnpm' | 'npm' | 'yarn' | 'bun',
  packages: string[],
): string[] {
  if (manager === 'npm') return ['install', ...packages];
  return ['add', ...packages];
}

async function promptText(
  runtime: CliRuntime,
  input: { interactive: boolean; message: string; placeholder: string },
): Promise<string> {
  requireInteractive(input.interactive, '--name is required with --new.');
  return runtime.prompts.text(input.message, input.placeholder);
}

function requireInteractive(
  interactive: boolean,
  message: string,
): asserts interactive {
  if (!interactive) {
    throw usageError('interactive_input_required', message);
  }
}

function nextSteps(framework: PackagePlan['framework']): string[] {
  if (framework === 'next') {
    return [
      'Next steps:',
      '  Configure an EdgeStore router in your Next.js app.',
      '  Add the EdgeStore provider to your client layout.',
    ];
  }
  if (framework === 'react') {
    return [
      'Next steps:',
      '  Configure an EdgeStore server endpoint.',
      '  Add the EdgeStore provider to your React app.',
    ];
  }
  return [
    'Next steps:',
    '  Configure an EdgeStore router and server endpoint.',
  ];
}
