import { applyChanges } from '../core/agent/files';
import { planMcp, type McpAction } from '../core/agent/mcp';
import { agentOptions } from '../core/agent/options';
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
  const options = await agentOptions(runtime, flags, input);
  const { client } = options;
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
    `${client}: ${result.status}\n${result.configPath}\n${result.warnings.join('\n')}${result.warnings.length ? '\n' : ''}${input.dryRun ? 'Dry run; no files changed.\n' : ''}Authentication was not checked. Open the client to connect when needed; review requested permissions and start with read-only consent. Configuration alone does not establish access or connectivity.`,
  );
}
