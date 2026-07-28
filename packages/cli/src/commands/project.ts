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

function missingProjectError() {
  return usageError(
    'project_context_required',
    'No project specified or linked.',
    ['edgestore project list', 'edgestore project link <basePath>'],
  );
}
