import { homedir } from 'node:os';
import path from 'node:path';
import { findGitRoot, findPackageRoot } from '../config';
import { usageError } from '../errors';
import { isInteractive, type CliRuntime, type GlobalFlags } from '../runtime';
import { CLIENTS, type AgentClient } from './clients';

export type AgentOptions = {
  client: AgentClient;
  project: string;
  home: string;
  stateRoot: string;
  global?: boolean;
  codexHome?: string;
};

export async function agentOptions(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { client?: string; global?: boolean },
): Promise<AgentOptions> {
  let client = input.client;
  if (!client && isInteractive(runtime, flags))
    client = await runtime.prompts.select(
      'Coding agent',
      CLIENTS.map((value) => ({ value, label: value })),
    );
  if (!CLIENTS.includes(client as AgentClient))
    throw usageError(
      'agent_client_required',
      'Select --client codex, claude, or cursor.',
    );
  return {
    client: client as AgentClient,
    project:
      (await findGitRoot(runtime.cwd)) ?? (await findPackageRoot(runtime.cwd)),
    home: path.resolve(runtime.env.HOME ?? homedir()),
    stateRoot: path.dirname(runtime.globalConfig.path),
    global: input.global,
    codexHome: runtime.env.CODEX_HOME,
  };
}
