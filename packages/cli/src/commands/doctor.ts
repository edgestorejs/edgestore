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
): Promise<void> {
  const checks: Check[] = [];
  const apiUrl = apiUrlFor(runtime, flags);

  await checkConfig(runtime, checks);
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
    try {
      const identity = await sdk.system.whoami({ signal: runtime.signal });
      checks.push({
        name: 'Authentication',
        status: 'pass',
        detail: identity.actor.kind,
      });
    } catch (error) {
      checks.push({
        name: 'Authentication',
        status: 'fail',
        detail: error instanceof Error ? error.message : 'Validation failed',
      });
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

async function checkConfig(
  runtime: CliRuntime,
  checks: Check[],
): Promise<void> {
  try {
    await runtime.globalConfig.read();
    checks.push({
      name: 'Global config',
      status: 'pass',
      detail: runtime.globalConfig.path,
    });
  } catch (error) {
    checks.push({
      name: 'Global config',
      status: 'fail',
      detail: error instanceof Error ? error.message : 'Could not read config',
    });
  }
}
