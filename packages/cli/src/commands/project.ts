import { DEFAULT_API_ORIGIN } from '../core/apiUrl';
import { renderCliCommand } from '../core/command';
import { apiOriginForRepoConfig } from '../core/config';
import { usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { apiUrlFor, isInteractive, outputFor, sdkFor } from '../core/runtime';
import { selectWorkspaceContext } from '../core/workspace';
import { activeAccount } from './account';

export async function projectListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: { account?: string },
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'read');
  const account = await activeAccount(runtime, flags, options.account);
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.list({
    account,
    signal: runtime.signal,
  });
  const local = await runtime.repoConfig.read();
  const currentApiOrigin = apiUrlFor(runtime, flags).displayUrl;
  const rows = result.projects.map((project) => [
    project.basePath === local?.config.project &&
    apiOriginForRepoConfig(local.config) === currentApiOrigin
      ? '*'
      : '',
    project.basePath,
    project.name,
    project.id,
  ]);
  const human = result.projects.length
    ? renderTable(['LINKED', 'BASE PATH', 'NAME', 'ID'], rows)
    : 'No projects found.';

  outputFor(runtime, flags).result(result, human);
}

export async function projectShowCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  projectRef?: string,
): Promise<void> {
  const project = await getProject(runtime, flags, projectRef);
  outputFor(runtime, flags).result(
    { project },
    [
      `Name: ${project.name}`,
      `Base path: ${project.basePath}`,
      `ID: ${project.id}`,
      `Account: ${project.accountId}`,
      `Usage: ${project.usageBytes} bytes`,
      `Created: ${project.createdAt}`,
    ].join('\n'),
    project.basePath,
  );
}

export async function projectCreateCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: {
    account?: string;
    name: string;
    withoutKey?: boolean;
    allowOverage?: boolean;
  },
): Promise<void> {
  if (flags.plain && !options.withoutKey) {
    throw usageError(
      'one_time_secret_delivery_required',
      'Plain output cannot deliver the initial project key.',
      [
        'Use --without-key with --plain.',
        'Use human or --json output to receive the one-time key.',
      ],
    );
  }
  const account = await activeAccount(runtime, flags, options.account);
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.create({
    account,
    name: options.name,
    createKey: !options.withoutKey,
    allowOverage: Boolean(options.allowOverage),
    signal: runtime.signal,
  });
  const keyLines = result.projectKey
    ? [
        '',
        `EDGE_STORE_ACCESS_KEY=${result.projectKey.key.accessKey}`,
        `EDGE_STORE_SECRET_KEY=${result.projectKey.secretKey}`,
        '',
        'Save this secret now. You will not be able to view it again.',
      ]
    : [];

  outputFor(runtime, flags).result(
    result,
    [
      `Created project "${result.project.name}" (${result.project.basePath}).`,
      ...keyLines,
      '',
      'Link this directory:',
      `  edgestore project link ${result.project.basePath}`,
    ].join('\n'),
    result.project.basePath,
  );
}

export async function projectDeleteCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: { project: string; yes?: boolean },
): Promise<void> {
  let project;
  if (!options.yes) {
    if (!isInteractive(runtime, flags)) {
      throw usageError(
        'confirmation_required',
        'Project deletion requires confirmation.',
        [
          renderCliCommand(flags, [
            'project',
            'delete',
            options.project,
            '--yes',
          ]),
        ],
      );
    }
    project = await getProject(runtime, flags, options.project);
    await runtime.prompts.confirmTyped(
      `Delete project "${project.name}"? Type ${project.basePath} to confirm`,
      project.basePath,
    );
  }

  const projectRef = project?.basePath ?? options.project;
  const sdk = await sdkFor(runtime, flags);
  await sdk.management.projects.delete({
    project: projectRef,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    { deleted: true, project: projectRef },
    project
      ? `Deleted project "${project.name}" (${project.basePath}).`
      : `Deleted project ${projectRef}.`,
    projectRef,
  );
}

export async function projectCurrentCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'read');
  const located = await runtime.repoConfig.read();
  if (!located) {
    throw missingProjectError();
  }

  outputFor(runtime, flags).result(
    {
      account: located.config.account,
      project: located.config.project,
      configPath: located.path,
    },
    [
      `Project: ${located.config.project}`,
      `Account: ${located.config.account}`,
      `Config: ${located.path}`,
    ].join('\n'),
    located.config.project,
  );
}

export async function projectLinkCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { projectRef: string; envFile?: string },
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'write');
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.get({
    project: input.projectRef,
    signal: runtime.signal,
  });
  const { project } = result;
  const apiOrigin = apiUrlFor(runtime, flags).displayUrl;
  const configPath = await runtime.repoConfig.write({
    account: project.accountId,
    project: project.basePath,
    ...(apiOrigin === DEFAULT_API_ORIGIN ? {} : { apiUrl: apiOrigin }),
    ...(input.envFile ? { envFile: input.envFile } : {}),
  });

  outputFor(runtime, flags).result(
    { ...result, configPath },
    [
      `Linked ${project.name} (${project.basePath}).`,
      `Config: ${configPath}`,
    ].join('\n'),
    project.basePath,
  );
}

export async function projectUnlinkCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'read');
  const configPath = await runtime.repoConfig.remove();
  if (!configPath) {
    throw missingProjectError();
  }

  outputFor(runtime, flags).result(
    { unlinked: true, configPath },
    `Unlinked the local project at ${configPath}.`,
    configPath,
  );
}

export async function resolvedProjectRef(
  runtime: CliRuntime,
  flags: GlobalFlags,
  explicit?: string,
): Promise<string> {
  if (explicit) return explicit;
  await selectWorkspaceContext(runtime, flags, 'read');
  const located = await runtime.repoConfig.read();
  if (!located) throw missingProjectError();
  const linkedApiOrigin = apiOriginForRepoConfig(located.config);
  const currentApiOrigin = apiUrlFor(runtime, flags).displayUrl;
  if (linkedApiOrigin !== currentApiOrigin) {
    throw usageError(
      'project_api_mismatch',
      `The linked project belongs to ${linkedApiOrigin}, but this command is using ${currentApiOrigin}.`,
      [
        `Run this command with --api-url ${linkedApiOrigin}.`,
        'Pass --project explicitly to use the current API instead of the repository link.',
      ],
    );
  }
  return located.config.project;
}

async function getProject(
  runtime: CliRuntime,
  flags: GlobalFlags,
  explicit?: string,
) {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.get({
    project: await resolvedProjectRef(runtime, flags, explicit),
    signal: runtime.signal,
  });
  return result.project;
}

export function missingProjectError() {
  return usageError(
    'project_context_required',
    'No project specified or linked.',
    ['edgestore project list', 'edgestore project link <basePath>'],
  );
}
