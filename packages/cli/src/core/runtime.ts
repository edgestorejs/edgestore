import { spawn } from 'node:child_process';
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

type ManagementClient = ManagementEdgeStoreSdk['management'];

export type CliSdk = {
  system: Pick<ManagementEdgeStoreSdk['system'], 'health'>;
  management: {
    whoami: ManagementClient['whoami'];
    accounts: Pick<ManagementClient['accounts'], 'list' | 'get' | 'leave'>;
    members: Pick<ManagementClient['members'], 'list' | 'update' | 'remove'>;
    invitations: Pick<
      ManagementClient['invitations'],
      'list' | 'create' | 'revoke' | 'resend'
    >;
    projects: Pick<
      ManagementClient['projects'],
      'list' | 'get' | 'create' | 'delete'
    >;
    projectKeys: Pick<
      ManagementClient['projectKeys'],
      'list' | 'create' | 'revoke'
    >;
    tokens: Pick<
      ManagementClient['tokens'],
      'listAccount' | 'listUser' | 'createAccount' | 'createUser' | 'revoke'
    >;
    buckets: Pick<
      ManagementClient['buckets'],
      'list' | 'get' | 'create' | 'delete' | 'empty' | 'emptyJobs'
    >;
    files: Pick<
      ManagementClient['files'],
      'list' | 'lookup' | 'generateAccessUrls' | 'delete'
    >;
    uploads: Pick<
      ManagementClient['uploads'],
      'upload' | 'get' | 'cancel' | 'request' | 'completeMultipart'
    >;
  };
};

export type SdkFactory = (options: {
  token: string;
  baseUrl: string;
}) => CliSdk;

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
  openUrl(url: string): Promise<void>;
  runCommand(
    command: string,
    args: string[],
    options?: { cwd?: string; stdout?: NodeJS.WritableStream },
  ): Promise<void>;
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
    openUrl,
    runCommand,
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
  flags: GlobalFlags,
): Promise<ResolvedCredential> {
  const apiUrl = apiUrlFor(runtime, flags);
  const credential = await resolveCredential(
    runtime.env.EDGESTORE_TOKEN,
    runtime.credentials,
    apiUrl.displayUrl,
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
): Promise<CliSdk> {
  const credential = await credentialFor(runtime, flags);
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

function openUrl(url: string): Promise<void> {
  if (process.platform === 'darwin') {
    return runCommand('open', [url]);
  }
  if (process.platform === 'win32') {
    return runCommand('cmd', ['/c', 'start', '', url]);
  }
  return runCommand('xdg-open', [url]);
}

function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; stdout?: NodeJS.WritableStream },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options?.cwd,
      stdio: options?.stdout ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    });
    if (options?.stdout) child.stdout?.pipe(options.stdout, { end: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} was terminated by ${signal}.`
            : `${command} exited with code ${code ?? 'unknown'}.`,
        ),
      );
    });
  });
}
