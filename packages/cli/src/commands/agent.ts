import { configurationStatus } from '../core/agent/status';
import { resolveApiUrl } from '../core/apiUrl';
import { inspectApplication } from '../core/application';
import { apiOriginForRepoConfig } from '../core/config';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor } from '../core/runtime';
import { selectWorkspaceContext } from '../core/workspace';

export async function agentContextCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { cliVersion: string; assetFile: string },
): Promise<void> {
  await selectWorkspaceContext(runtime, flags, 'read');
  const application = await inspectApplication(runtime.workspaceCwd);
  const linked = await runtime.repoConfig.read();
  const configurations = await configurationStatus(
    runtime,
    flags,
    input.assetFile,
  );
  const selectionRequired =
    !flags.cwd && !linked && application.candidateWorkspaces.length > 0;
  const result = {
    schemaVersion: 1,
    cliVersion: input.cliVersion,
    selectionRequired,
    application,
    ...(application.compatibility === 'not-installed'
      ? {
          referenceFallback: {
            url: 'https://next.edgestore.dev/docs/agents',
            warning:
              'Prerelease setup guidance; resolve installed package references after installation.',
          },
        }
      : {}),
    project: linked
      ? {
          account: linked.config.account,
          project: linked.config.project,
          apiUrl: resolveApiUrl(
            apiOriginForRepoConfig(linked.config),
            undefined,
          ).displayUrl,
          configPath: linked.path,
          envFile: linked.config.envFile,
        }
      : null,
    agentConfiguration: configurations.map(({ client, skills }) => ({
      client,
      ...skills,
    })),
    mcpConfiguration: configurations.map(({ client, mcp }) => ({
      client,
      ...mcp,
    })),
  };
  if (selectionRequired) runtime.exitCode = 2;
  outputFor(runtime, flags).result(
    result,
    [
      `Application: ${application.directory}`,
      `Framework: ${application.framework} (${application.role})`,
      `Package manager: ${application.packageManager}`,
      ...application.packages.map(
        (pkg) => `${pkg.name}: ${pkg.version ?? pkg.status}`,
      ),
      ...application.warnings,
      ...(selectionRequired
        ? [
            'Select an application workspace with --cwd before implementing.',
            ...application.candidateWorkspaces.map((pkg) => pkg.directory),
          ]
        : []),
    ].join('\n'),
  );
}
