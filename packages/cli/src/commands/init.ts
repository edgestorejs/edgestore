import path from 'node:path';
import type { ManagementEdgeStoreSdk } from '@edgestore/sdk';
import { DEFAULT_API_ORIGIN } from '../core/apiUrl';
import { renderCliCommand } from '../core/command';
import { withActiveAccount } from '../core/config';
import { CliError, normalizeError, usageError } from '../core/errors';
import {
  detectPackages,
  installPackages,
  packageNextSteps,
} from '../core/packageInstall';
import type { CliRuntime, CliSdk, GlobalFlags } from '../core/runtime';
import { apiUrlFor, isInteractive, outputFor, sdkFor } from '../core/runtime';
import {
  deliverEnvSecretWithRollback,
  preflightEnvSecret,
} from '../core/secretDelivery';
import {
  projectKeyName,
  protectSecretFile,
  resolveSecretOutput,
} from '../core/secretFile';
import { isWorkspaceRoot, selectWorkspaceContext } from '../core/workspace';
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

type InitProject = Awaited<
  ReturnType<ManagementEdgeStoreSdk['management']['projects']['get']>
>['project'];
type InitProjectKey = Awaited<
  ReturnType<ManagementEdgeStoreSdk['management']['projectKeys']['create']>
>['key'];
type InitBucket = Awaited<
  ReturnType<ManagementEdgeStoreSdk['management']['buckets']['create']>
>['bucket'];

type InitCompletedStep =
  'project' | 'project_key' | 'secret_delivery' | 'repository_link' | 'bucket';

type InitFailedStep = 'repository_link' | 'bucket_creation' | 'package_install';

type PartialInitState = {
  project: InitProject;
  projectCreated?: boolean;
  key?: InitProjectKey;
  bucket?: InitBucket;
  configPath?: string;
  output?: string;
  completedSteps: InitCompletedStep[];
  failedStep: InitFailedStep;
  continuation?: string;
};

type InitContext = {
  runtime: CliRuntime;
  sdk: CliSdk;
  flags: GlobalFlags;
  options: InitOptions;
  interactive: boolean;
  account: string;
};

export async function initCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: InitOptions,
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'write');
  const packageCwd = runtime.workspaceCwd;
  const interactive = isInteractive(runtime, flags);
  validateOptions(options, interactive);
  const packages = await detectPackages(packageCwd, {
    installAtWorkspaceRoot: await isWorkspaceRoot(packageCwd),
  });
  const sdk = await sdkFor(runtime, flags);
  const account = await resolveAccount({
    runtime,
    sdk,
    flags,
    options,
    interactive,
  });
  const context = { runtime, sdk, flags, options, interactive, account };
  const mode = await resolveMode(runtime, options, interactive);
  const createKey = await shouldCreateKey(context, mode);
  const secretOutput = createKey
    ? await resolveSecretOutput(runtime, options.output, interactive)
    : undefined;
  const bucketChoice = await resolveBucket(runtime, options, interactive);
  let envFile: string | undefined;
  if (secretOutput) {
    await preflightEnvSecret(
      packageCwd,
      ['EDGE_STORE_ACCESS_KEY', 'EDGE_STORE_SECRET_KEY'],
      { output: secretOutput, update: options.update },
    );
    envFile = await protectSecretFile(packageCwd, secretOutput);
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
          name: projectKeyName(secretOutput),
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
        cwd: packageCwd,
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

  const apiOrigin = apiUrlFor(runtime, flags).displayUrl;
  const completedSteps: InitCompletedStep[] = ['project'];
  if (keyResult) completedSteps.push('project_key');
  if (keyResult && secretOutput) completedSteps.push('secret_delivery');
  let configPath: string;
  try {
    configPath = await runtime.repoConfig.write({
      account: projectResult.project.accountId,
      project: projectResult.project.basePath,
      ...(apiOrigin === DEFAULT_API_ORIGIN ? {} : { apiUrl: apiOrigin }),
      ...(envFile ? { envFile } : {}),
    });
  } catch (error) {
    if (mode !== 'new' && !keyResult) throw error;
    throw partialInitError(error, {
      project: projectResult.project,
      projectCreated: mode === 'new',
      key: keyResult?.key,
      output: secretOutput,
      completedSteps,
      failedStep: 'repository_link',
      continuation: renderCliCommand(flags, [
        'project',
        'link',
        projectResult.project.basePath,
        ...(envFile ? ['--env-file', envFile] : []),
      ]),
    });
  }
  completedSteps.push('repository_link');

  let bucket: InitBucket | undefined;
  if (bucketChoice) {
    const continuation = renderCliCommand(
      flags,
      [
        'bucket',
        'create',
        bucketChoice.name,
        '--type',
        bucketChoice.type,
        bucketChoice.visibility === 'public' ? '--public' : '--protected',
      ],
      { project: projectResult.project.basePath },
    );
    try {
      bucket = (
        await sdk.management.buckets.create({
          project: projectResult.project.basePath,
          name: bucketChoice.name,
          type: bucketChoice.type,
          visibility: bucketChoice.visibility,
          signal: runtime.signal,
        })
      ).bucket;
      completedSteps.push('bucket');
    } catch (error) {
      throw partialInitError(error, {
        project: projectResult.project,
        key: keyResult?.key,
        configPath,
        output: secretOutput,
        completedSteps,
        failedStep: 'bucket_creation',
        continuation,
      });
    }
  }

  let install: Awaited<ReturnType<typeof installPackages>>;
  try {
    install = await installPackages(runtime, packages, {
      cwd: packageCwd,
      invocationCwd: runtime.cwd,
      requested: options.install,
      interactive,
      structured: Boolean(flags.json || flags.plain),
      json: Boolean(flags.json),
    });
  } catch (error) {
    const failure = normalizeError(error);
    throw partialInitError(failure, {
      project: projectResult.project,
      key: keyResult?.key,
      bucket,
      configPath,
      output: secretOutput,
      completedSteps,
      failedStep: 'package_install',
      continuation: failure.options.suggestions?.[0],
    });
  }

  const human = [
    `Linked ${projectResult.project.name} (${projectResult.project.basePath}).`,
    `Config: ${configPath}`,
    ...(secretOutput
      ? [`Secrets: ${path.resolve(packageCwd, secretOutput)}`]
      : []),
    ...(bucket ? [`Bucket: ${bucket.name}`] : []),
    ...(install.command && !install.ran
      ? ['', 'Install packages:', `  ${install.command}`]
      : []),
    '',
    ...packageNextSteps(packages.framework),
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

function partialInitError(error: unknown, state: PartialInitState): CliError {
  const failure = normalizeError(error);
  const label = {
    repository_link: 'repository linking',
    bucket_creation: 'bucket creation',
    package_install: 'package installation',
  }[state.failedStep];
  const completed = state.completedSteps
    .map((step) => step.replaceAll('_', ' '))
    .join(', ');
  const suggestions = Array.from(
    new Set(
      [state.continuation, ...(failure.options.suggestions ?? [])].filter(
        (suggestion): suggestion is string => Boolean(suggestion),
      ),
    ),
  );
  const prefix =
    state.failedStep === 'repository_link'
      ? state.projectCreated
        ? `Project ${state.project.basePath} was created, but`
        : `Project key ${state.key?.id ?? 'unknown'} was created, but`
      : 'The project is linked, but';
  return new CliError(
    'init_partial_failure',
    `${prefix} ${label} failed: ${failure.message} Completed: ${completed}.`,
    {
      details: {
        status: 'partial',
        completedSteps: state.completedSteps,
        failedStep: state.failedStep,
        project: state.project,
        ...(state.key ? { key: state.key } : {}),
        ...(state.bucket ? { bucket: state.bucket } : {}),
        ...(state.configPath ? { configPath: state.configPath } : {}),
        ...(state.output ? { output: state.output } : {}),
        cause: {
          code: failure.code,
          message: failure.message,
          ...(failure.options.details === undefined
            ? {}
            : { details: failure.options.details }),
        },
      },
      requestId: failure.options.requestId,
      ...(suggestions.length ? { suggestions } : {}),
      exitCode: failure.exitCode,
    },
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
  const { runtime, sdk, flags, options, interactive } = context;
  if (options.account) return options.account;
  try {
    return await activeAccount(runtime, flags);
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
  await runtime.globalConfig.write(
    withActiveAccount(config, apiUrlFor(runtime, flags).displayUrl, selected),
  );
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
      placeholder: path.basename(runtime.workspaceCwd),
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

function validateBucketName(name: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/.test(name)) {
    throw usageError(
      'invalid_bucket_name',
      'Bucket names must begin with a letter or number and contain only letters, numbers, underscores, or hyphens.',
    );
  }
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
