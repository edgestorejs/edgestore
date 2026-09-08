import { homedir } from 'node:os';
import path from 'node:path';
import { CLIENTS, type AgentClient } from '../core/agent/clients';
import { applyChanges } from '../core/agent/files';
import { planMcp, type McpAction } from '../core/agent/mcp';
import { findGitRoot, findPackageRoot } from '../core/config';
import { usageError } from '../core/errors';
import {
  isInteractive,
  outputFor,
  type CliRuntime,
  type GlobalFlags,
} from '../core/runtime';

export async function mcpCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    action: McpAction;
    client?: string;
    global?: boolean;
    dryRun?: boolean;
    yes?: boolean;
  },
): Promise<void> {
  const { action } = input;
  let client = input.client;
  if (!client && isInteractive(runtime, flags)) {
    client = await runtime.prompts.select(
      'Coding agent',
      CLIENTS.map((value) => ({ value, label: value })),
    );
  }
  if (!CLIENTS.includes(client as AgentClient))
    throw usageError(
      'agent_client_required',
      'Select --client codex, claude, or cursor.',
    );
  const options = {
    client: client as AgentClient,
    project:
      (await findGitRoot(runtime.cwd)) ?? (await findPackageRoot(runtime.cwd)),
    home: path.resolve(runtime.env.HOME ?? homedir()),
    stateRoot: path.dirname(runtime.globalConfig.path),
    global: input.global,
    codexHome: runtime.env.CODEX_HOME,
  };
  const plan = await planMcp(options, action);
  if (plan.changes.length && !input.dryRun) {
    if (!input.yes) {
      if (!isInteractive(runtime, flags))
        throw usageError(
          'confirmation_required',
          'Use --yes to apply configuration changes, or --dry-run to inspect them.',
        );
      if (
        !(await runtime.prompts.confirm(
          `Apply ${action} to ${plan.result.configPath}?`,
        ))
      )
        return;
    }
    await applyChanges(plan.changes);
  }
  const current =
    plan.changes.length && !input.dryRun
      ? (await planMcp(options, 'status')).result
      : plan.result;
  const result = {
    ...current,
    action,
    dryRun: Boolean(input.dryRun),
    changedFiles: input.dryRun ? [] : plan.changes.map(({ file }) => file),
    plannedFiles: plan.result.plannedFiles,
  };
  outputFor(runtime, flags).result(
    result,
    `${client}: ${result.status}\n${result.configPath}\n${input.dryRun ? 'Dry run; no files changed.\n' : ''}Authentication was not checked. Open the client to connect when needed; review requested permissions and start with read-only consent. Configuration alone does not establish access or connectivity.`,
  );
}
