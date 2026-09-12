import { CliError } from '../errors';
import type { CliRuntime, GlobalFlags } from '../runtime';
import { CLIENTS } from './clients';
import { planMcp } from './mcp';
import { agentOptions } from './options';
import { loadSkillBundle, planSkills } from './skills';

export async function configurationStatus(
  runtime: CliRuntime,
  flags: GlobalFlags,
  assetFile: string,
) {
  const bundle = await loadSkillBundle(assetFile).catch(() => undefined);
  return Promise.all(
    CLIENTS.map(async (client) => {
      const options = await agentOptions(runtime, flags, { client });
      const skills = bundle
        ? await planSkills(options, bundle, 'status').then(
            (plan) => plan.result,
            unavailable,
          )
        : { status: 'bundle-unavailable' };
      const mcp = await planMcp(options, 'status').then(
        (plan) => plan.result,
        unavailable,
      );
      return { client, skills, mcp };
    }),
  );
}

function unavailable(error: unknown) {
  return {
    status: 'not-inspected',
    code: error instanceof CliError ? error.code : 'configuration_unreadable',
  };
}
