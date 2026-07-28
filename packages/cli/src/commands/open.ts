import { usageError } from '../core/errors';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { outputFor } from '../core/runtime';
import { resolvedProjectRef } from './project';

type OpenTarget = 'account' | 'billing' | 'keys' | 'project';

export async function openCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  input: { target?: string; project?: string },
): Promise<void> {
  const target = parseTarget(input.target);
  const project =
    target === 'project' || target === 'keys'
      ? await resolvedProjectRef(runtime, input.project)
      : undefined;
  const url = dashboardUrl(runtime, target, project);

  if (!flags.json && !flags.plain) {
    await runtime.openUrl(url);
  }
  outputFor(runtime, flags).result(
    { target: target ?? 'dashboard', project, url },
    `Opened ${url}`,
    url,
  );
}

function parseTarget(value?: string): OpenTarget | undefined {
  if (!value) return undefined;
  if (
    value === 'account' ||
    value === 'billing' ||
    value === 'keys' ||
    value === 'project'
  ) {
    return value;
  }
  throw usageError(
    'invalid_open_target',
    `Unsupported dashboard target: ${value}.`,
    ['Choose account, billing, project, or keys.'],
  );
}

function dashboardUrl(
  runtime: CliRuntime,
  target: OpenTarget | undefined,
  project?: string,
): string {
  const base = (
    runtime.env.EDGESTORE_DASHBOARD_URL ?? 'https://dashboard.edgestore.dev'
  ).replace(/\/+$/, '');
  if (!target) return base;
  if (target === 'account') return `${base}/settings`;
  if (target === 'billing') return `${base}/settings/billing`;
  return `${base}/projects/${encodeURIComponent(project ?? '')}`;
}
