import path from 'node:path';
import {
  createEdgeStoreSdk,
  type ManagementEdgeStoreSdk,
} from '@edgestore/sdk';
import envPaths from 'env-paths';
import { resolveApiUrl, type ResolvedApiUrl } from './apiUrl';
import {
  GlobalConfigStore,
  RepoConfigStore,
  type GlobalConfig,
  type LocatedRepoConfig,
  type RepoConfig,
} from './config';
import {
  KeyringCredentialStore,
  resolveCredential,
  type CredentialStore,
  type ResolvedCredential,
} from './credentials';
import { usageError } from './errors';
import { CliOutput, type OutputMode } from './output';
import { DefaultCliPrompts, type CliPrompts } from './prompts';

export type GlobalFlags = {
  json?: boolean;
  plain?: boolean;
  apiUrl?: string;
  color: boolean;
  progress: boolean;
};

export type RuntimeIo = {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
  inputIsTty: boolean;
  outputIsTty: boolean;
};

export type SdkFactory = (options: {
  token: string;
  baseUrl: string;
}) => ManagementEdgeStoreSdk;

export type CliRuntime = {
  exitCode: number;
  cwd: string;
  env: NodeJS.ProcessEnv;
  io: RuntimeIo;
  signal: AbortSignal;
  globalConfig: {
    path: string;
    read(): Promise<GlobalConfig>;
    write(config: GlobalConfig): Promise<void>;
  };
  repoConfig: {
    read(): Promise<LocatedRepoConfig | undefined>;
    write(config: RepoConfig): Promise<string>;
    remove(): Promise<string | undefined>;
  };
  credentials: CredentialStore;
  prompts: CliPrompts;
  sdkFactory: SdkFactory;
};

export function createDefaultRuntime(signal: AbortSignal): CliRuntime {
  const paths = envPaths('edgestore', { suffix: '' });

  return {
    exitCode: 0,
    cwd: process.cwd(),
    env: process.env,
    io: {
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      inputIsTty: Boolean(process.stdin.isTTY),
      outputIsTty: Boolean(process.stdout.isTTY),
    },
    signal,
    globalConfig: new GlobalConfigStore(path.join(paths.config, 'config.json')),
    repoConfig: new RepoConfigStore(process.cwd()),
    credentials: new KeyringCredentialStore(),
    prompts: new DefaultCliPrompts(),
    sdkFactory: ({ token, baseUrl }) =>
      createEdgeStoreSdk({ credentials: { token }, apiUrl: baseUrl }),
  };
}

export function outputFor(runtime: CliRuntime, flags: GlobalFlags): CliOutput {
  const mode = getOutputMode(flags);
  return new CliOutput(runtime.io, {
    mode,
    color:
      flags.color &&
      runtime.io.outputIsTty &&
      runtime.env.NO_COLOR === undefined,
  });
}

export function apiUrlFor(
  runtime: CliRuntime,
  flags: GlobalFlags,
): ResolvedApiUrl {
  return resolveApiUrl(flags.apiUrl, runtime.env.EDGESTORE_API_URL);
}

export async function credentialFor(
  runtime: CliRuntime,
): Promise<ResolvedCredential> {
  const credential = await resolveCredential(
    runtime.env.EDGESTORE_TOKEN,
    runtime.credentials,
  );
  if (!credential) {
    throw usageError('authentication_required', 'Not logged in.', [
      'edgestore login --token',
    ]);
  }
  return credential;
}

export async function sdkFor(
  runtime: CliRuntime,
  flags: GlobalFlags,
): Promise<ManagementEdgeStoreSdk> {
  const credential = await credentialFor(runtime);
  return runtime.sdkFactory({
    token: credential.token,
    baseUrl: apiUrlFor(runtime, flags).sdkBaseUrl,
  });
}

function getOutputMode(flags: GlobalFlags): OutputMode {
  if (flags.json && flags.plain) {
    throw usageError(
      'conflicting_output_modes',
      '--json and --plain cannot be used together.',
    );
  }
  if (flags.json) {
    return 'json';
  }
  if (flags.plain) {
    return 'plain';
  }
  return 'human';
}
