import { createHash } from 'node:crypto';
import path from 'node:path';

export const frameworks = ['next', 'vite-hono', 'start'] as const;
export type Framework = (typeof frameworks)[number];
export const packageNames = [
  'shared',
  'sdk',
  'server',
  'react',
  'cli',
] as const;
export type PackageName = (typeof packageNames)[number];

export function framework(value: string | undefined): Framework {
  if (!frameworks.includes(value as Framework))
    throw new Error('Choose next, vite-hono, or start.');
  return value as Framework;
}

export function inside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  );
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

// Defense in depth. Evaluation processes receive an allowlisted environment;
// management credentials must never enter an agent workspace or transcript.
export function sanitize(value: string, secrets: string[] = []): string {
  let result = value;
  for (const secret of secrets
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    result = result.replaceAll(secret, '[REDACTED]');
  return result
    .replace(
      /https?:\/\/[^\s<>"']*[?][^\s<>"']*/gi,
      '[URL_WITH_QUERY_REDACTED]',
    )
    .replace(
      /((?:EDGE_STORE_(?:ACCESS_KEY|SECRET_KEY)|EDGESTORE_TOKEN|Authorization)["']?\s*[:=]\s*)[^\r\n]+/gi,
      '$1[REDACTED]',
    );
}

export function isolatedEnv(
  home: string,
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  return {
    PATH: source.PATH,
    TMPDIR: source.TMPDIR,
    SystemRoot: source.SystemRoot,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    CODEX_HOME: path.join(home, '.codex'),
    CI: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    DISABLE_TELEMETRY: '1',
    pnpm_config_verify_deps_before_run: 'false',
  };
}

export type CheckResult = {
  status: 'passed' | 'failed' | 'not-run';
  detail?: string;
};

export function initialResults() {
  return {
    artifact: { status: 'not-run' } as CheckResult,
    baseline: { status: 'not-run' } as CheckResult,
    skill: { status: 'not-run' } as CheckResult,
    live: { status: 'not-run' } as CheckResult,
  };
}
