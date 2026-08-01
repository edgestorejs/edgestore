import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocatedRepoConfig } from '../core/config';
import { resolveCredential } from '../core/credentials';
import { renderTable } from '../core/output';
import type { CliRuntime, GlobalFlags } from '../core/runtime';
import { apiUrlFor, outputFor } from '../core/runtime';

type Check = {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export async function doctorCommand(
  runtime: CliRuntime,
  flags: GlobalFlags,
  version: string,
): Promise<void> {
  const checks: Check[] = [{ name: 'CLI', status: 'pass', detail: version }];
  const apiUrl = apiUrlFor(runtime, flags);

  const globalConfig = await checkGlobalConfig(runtime, checks);
  const localConfig = await checkLocalConfig(runtime, checks);
  const envKeys = await checkEnvFile(runtime, checks);
  const keychainAvailable = await runtime.credentials.available();
  checks.push({
    name: 'Credential store',
    status: keychainAvailable ? 'pass' : 'warn',
    detail: keychainAvailable
      ? 'OS credential store module is available'
      : 'Unavailable; EDGESTORE_TOKEN is still supported',
  });

  let credential;
  try {
    credential = await resolveCredential(
      runtime.env.EDGESTORE_TOKEN,
      runtime.credentials,
    );
    checks.push({
      name: 'Credential',
      status: credential ? 'pass' : 'warn',
      detail: credential ? credential.source : 'Not configured',
    });
  } catch (error) {
    checks.push({
      name: 'Credential',
      status: 'fail',
      detail:
        error instanceof Error ? error.message : 'Could not read credential',
    });
  }

  const sdk = runtime.sdkFactory({
    token: credential?.token ?? 'edgestore-doctor',
    baseUrl: apiUrl.sdkBaseUrl,
  });
  try {
    await sdk.system.health({ signal: runtime.signal });
    checks.push({ name: 'API', status: 'pass', detail: apiUrl.displayUrl });
  } catch (error) {
    checks.push({
      name: 'API',
      status: 'fail',
      detail: error instanceof Error ? error.message : 'Health check failed',
    });
  }

  if (credential) {
    let authenticated = false;
    try {
      const identity = await sdk.management.whoami({ signal: runtime.signal });
      authenticated = true;
      const scopeDetail =
        'scopes' in identity.actor
          ? ` (${identity.actor.scopes.join(', ')})`
          : '';
      checks.push({
        name: 'Authentication',
        status: 'pass',
        detail: `${identity.actor.kind}${scopeDetail}`,
      });
    } catch (error) {
      checks.push({
        name: 'Authentication',
        status: 'fail',
        detail: error instanceof Error ? error.message : 'Validation failed',
      });
    }

    if (authenticated && globalConfig.activeAccount) {
      try {
        const account = await sdk.management.accounts.get({
          account: globalConfig.activeAccount,
          signal: runtime.signal,
        });
        checks.push({
          name: 'Active account',
          status: 'pass',
          detail: `${account.account.displayName} (${account.account.id})`,
        });
      } catch (error) {
        checks.push({
          name: 'Active account',
          status: 'fail',
          detail:
            error instanceof Error ? error.message : 'Account is inaccessible',
        });
      }
    } else if (authenticated) {
      checks.push({
        name: 'Active account',
        status: 'warn',
        detail: 'Not selected',
      });
    }

    if (authenticated && localConfig) {
      try {
        await checkLinkedProject(runtime, sdk, {
          local: localConfig,
          envKeys,
          checks,
        });
      } catch (error) {
        checks.push({
          name: 'Linked project',
          status: 'fail',
          detail:
            error instanceof Error ? error.message : 'Project is inaccessible',
        });
      }
    }
  }

  if (checks.some((check) => check.status === 'fail')) {
    runtime.exitCode = 1;
  }

  outputFor(runtime, flags).result(
    { checks },
    renderTable(
      ['CHECK', 'STATUS', 'DETAIL'],
      checks.map((check) => [check.name, check.status, check.detail]),
    ),
  );
}

async function checkGlobalConfig(
  runtime: CliRuntime,
  checks: Check[],
): Promise<Awaited<ReturnType<CliRuntime['globalConfig']['read']>>> {
  try {
    const config = await runtime.globalConfig.read();
    checks.push({
      name: 'Global config',
      status: 'pass',
      detail: runtime.globalConfig.path,
    });
    return config;
  } catch (error) {
    checks.push({
      name: 'Global config',
      status: 'fail',
      detail: error instanceof Error ? error.message : 'Could not read config',
    });
    return { version: 1 };
  }
}

async function checkLocalConfig(
  runtime: CliRuntime,
  checks: Check[],
): Promise<LocatedRepoConfig | undefined> {
  try {
    const located = await runtime.repoConfig.read();
    checks.push({
      name: 'Local config',
      status: located ? 'pass' : 'warn',
      detail: located?.path ?? 'No linked project',
    });
    return located;
  } catch (error) {
    checks.push({
      name: 'Local config',
      status: 'fail',
      detail:
        error instanceof Error ? error.message : 'Could not read local config',
    });
    return undefined;
  }
}

type EnvKeys = {
  accessKey?: string;
  hasSecretKey: boolean;
};

async function checkEnvFile(
  runtime: CliRuntime,
  checks: Check[],
): Promise<EnvKeys> {
  let contents = '';
  try {
    contents = await readFile(path.join(runtime.cwd, '.env.local'), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      checks.push({
        name: '.env.local',
        status: 'fail',
        detail: 'Could not read file',
      });
    }
    return { hasSecretKey: false };
  }
  const accessKey = envValue(contents, 'EDGE_STORE_ACCESS_KEY');
  const hasSecretKey = Boolean(envValue(contents, 'EDGE_STORE_SECRET_KEY'));
  checks.push({
    name: '.env.local',
    status: accessKey && hasSecretKey ? 'pass' : 'warn',
    detail: [
      `EDGE_STORE_ACCESS_KEY ${accessKey ? 'present' : 'missing'}`,
      `EDGE_STORE_SECRET_KEY ${hasSecretKey ? 'present' : 'missing'}`,
    ].join(', '),
  });
  return { accessKey, hasSecretKey };
}

async function checkLinkedProject(
  runtime: CliRuntime,
  sdk: ReturnType<CliRuntime['sdkFactory']>,
  input: {
    local: LocatedRepoConfig;
    envKeys: EnvKeys;
    checks: Check[];
  },
): Promise<void> {
  const { local, envKeys, checks } = input;
  const result = await sdk.management.projects.get({
    project: local.config.project,
    signal: runtime.signal,
  });
  const belongsToConfiguredAccount =
    result.project.accountId === local.config.account;
  checks.push({
    name: 'Linked project',
    status: belongsToConfiguredAccount ? 'pass' : 'fail',
    detail: belongsToConfiguredAccount
      ? `${result.project.name} (${result.project.basePath})`
      : `Belongs to ${result.project.accountId}, config says ${local.config.account}`,
  });
  if (!envKeys.accessKey) return;
  try {
    const keys = await sdk.management.projectKeys.list({
      project: result.project.basePath,
      signal: runtime.signal,
    });
    if (keys.keys.some((key) => key.accessKey === envKeys.accessKey)) return;
    checks.push({
      name: 'Environment project',
      status: 'warn',
      detail: '.env.local access key is not for the linked project',
    });
  } catch {
    checks.push({
      name: 'Environment project',
      status: 'warn',
      detail: 'Could not compare .env.local with project key metadata',
    });
  }
}

function envValue(contents: string, name: string): string | undefined {
  const match = new RegExp(`^${name}=(.+)$`, 'm').exec(contents);
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}
