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
          'Use --yes to apply changes or --dry-run to preview them.',
        );
      if (
        !(await runtime.prompts.confirm(
          `${action === 'remove' ? 'Remove EdgeStore MCP from' : 'Configure EdgeStore MCP in'} ${plan.result.configPath}?`,
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
    [
      `${client}: ${result.status}`,
      result.configPath,
      ...result.warnings,
      ...(input.dryRun ? ['Dry run; no files changed.'] : []),
      ...(action === 'status'
        ? ['Connection and sign-in were not checked.']
        : []),
      ...(!input.dryRun && action === 'setup'
        ? ['Open your client to connect EdgeStore.']
        : []),
    ].join('\n'),
  );
}
