import { usageError } from '../core/errors';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor, sdkFor } from '../core/runtime';
import { activeAccount } from './account';

export async function projectListCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  options: { account?: string },
): Promise<void> {
  const account = await activeAccount(runtime, options.account);
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.list({
    account,
    signal: runtime.signal,
  });
  const local = await runtime.repoConfig.read();
  const rows = result.projects.map((project) => [
    project.basePath === local?.config.project ? '*' : '',
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
  const account = await activeAccount(runtime, options.account);
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
  const project = await getProject(runtime, flags, options.project);
  if (!options.yes) {
    if (!runtime.io.inputIsTty || flags.json) {
      throw usageError(
        'confirmation_required',
        'Project deletion requires confirmation.',
        [`edgestore project delete ${project.basePath} --yes`],
      );
    }
    await runtime.prompts.confirmTyped(
      `Delete project "${project.name}"? Type ${project.basePath} to confirm`,
      project.basePath,
    );
  }

  const sdk = await sdkFor(runtime, flags);
  await sdk.management.projects.delete({
    project: project.basePath,
    signal: runtime.signal,
  });
  outputFor(runtime, flags).result(
    { deleted: true, project },
    `Deleted project "${project.name}" (${project.basePath}).`,
    project.basePath,
  );
}

export async function projectCurrentCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<void> {
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
  projectRef: string,
): Promise<void> {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.get({
    project: projectRef,
    signal: runtime.signal,
  });
  const { project } = result;
  const configPath = await runtime.repoConfig.write({
    account: project.accountId,
    project: project.basePath,
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
  explicit?: string,
): Promise<string> {
  if (explicit) return explicit;
  const located = await runtime.repoConfig.read();
  if (!located) throw missingProjectError();
  return located.config.project;
}

async function getProject(
  runtime: CliRuntime,
  flags: GlobalFlags,
  explicit?: string,
) {
  const sdk = await sdkFor(runtime, flags);
  const result = await sdk.management.projects.get({
    project: await resolvedProjectRef(runtime, explicit),
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
