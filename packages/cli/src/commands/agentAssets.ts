import { applyChanges } from '../core/agent/files';
import { planMcp } from '../core/agent/mcp';
import { agentOptions } from '../core/agent/options';
import { loadSkillBundle, planSkills } from '../core/agent/skills';
import { usageError } from '../core/errors';
import {
  isInteractive,
  outputFor,
  type CliRuntime,
  type GlobalFlags,
} from '../core/runtime';

export async function agentAssetsCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: {
    action: 'setup' | 'update' | 'status';
    assetFile: string;
    client?: string;
    global?: boolean;
    skillsOnly?: boolean;
    dryRun?: boolean;
    yes?: boolean;
  },
) {
  const options = await agentOptions(runtime, flags, input);
  const bundle = await loadSkillBundle(input.assetFile);
  const skills = await planSkills(options, bundle, input.action);
  const mcp = input.skillsOnly
    ? undefined
    : await planMcp(options, input.action === 'status' ? 'status' : 'setup');
  const changes = [...skills.changes, ...(mcp?.changes ?? [])];
  if (changes.length && !input.dryRun) {
    if (!input.yes) {
      if (!isInteractive(runtime, flags))
        throw usageError(
          'confirmation_required',
          'Use --yes to apply changes or --dry-run to preview them.',
        );
      if (
        !(await runtime.prompts.confirm(
          `Apply ${input.skillsOnly ? 'skill' : 'skill and MCP'} changes for ${options.client} at ${options.global ? options.home : options.project}?`,
        ))
      )
        return;
    }
    // Both plans are preflighted before any asset or MCP configuration is changed.
    await applyChanges(changes);
  }
  const current =
    !input.dryRun && changes.length
      ? await planSkills(options, bundle, 'status')
      : skills;
  const connection =
    mcp && !input.dryRun && changes.length
      ? await planMcp(options, 'status')
      : mcp;
  const result = {
    schemaVersion: 1,
    client: options.client,
    scope: options.global ? 'global' : 'project',
    action: input.action,
    dryRun: Boolean(input.dryRun),
    skills: current.result,
    mcp: connection?.result ?? {
      status: 'not-inspected',
      reason: 'skills-only',
    },
    changes: changes.map(({ file, before, after }) => ({
      file,
      action:
        after === undefined
          ? 'remove'
          : before === undefined
            ? 'create'
            : 'update',
      applied: !input.dryRun,
    })),
  };
  outputFor(runtime, flags).result(
    result,
    [
      `${options.client}: skill ${current.result.status}`,
      current.result.directory,
      `Bundled revision: ${bundle.revision}`,
      ...changes.map(
        ({ file }) => `${input.dryRun ? 'Would change' : 'Changed'}: ${file}`,
      ),
      ...current.result.otherSources.map((file) => `Skill found at: ${file}`),
      ...(connection?.result.warnings ?? []),
      ...(current.result.status === 'update-available'
        ? ['Run edgestore agent update to install the skill from this CLI.']
        : []),
      ...(!input.dryRun && skills.changes.length
        ? ['Restart your client or open a new task to load the skill.']
        : []),
      ...(!input.dryRun && mcp?.changes.length
        ? ['Open your client to connect EdgeStore.']
        : []),
    ].join('\n'),
  );
}
