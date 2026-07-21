import type {
  EdgeStoreCredentials,
  ManagementCredentials,
  ProjectCredentials,
} from './credentials';
import { createTransport } from './internal/transport';
import {
  createManagementClient,
  type ManagementClient,
} from './managementClient';
import {
  createExplicitProjectRuntimeClient,
  createProjectRuntimeClient,
  type ExplicitProjectRuntimeClient,
  type ProjectRuntimeClient,
} from './runtime';
import { createSystemClient, type SystemClient } from './system';
import type { UploadDefaults } from './uploadTypes';

export type EdgeStoreSdkOptions<
  TCredentials extends EdgeStoreCredentials = EdgeStoreCredentials,
> = {
  credentials: TCredentials;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Defaults used by the complete-upload helpers. */
  upload?: UploadDefaults;
  /** Default timeout for API control-plane requests. Use an AbortSignal for a per-call timeout. */
  controlTimeoutMs?: number;
};

export type ProjectEdgeStoreSdk = {
  runtime: ProjectRuntimeClient;
  system: SystemClient;
};
export type ManagementEdgeStoreSdk = {
  runtime: ExplicitProjectRuntimeClient;
  management: ManagementClient;
  system: SystemClient;
};

export function createEdgeStoreSdk(
  options: EdgeStoreSdkOptions<ProjectCredentials>,
): ProjectEdgeStoreSdk;
export function createEdgeStoreSdk(
  options: EdgeStoreSdkOptions<ManagementCredentials>,
): ManagementEdgeStoreSdk;
export function createEdgeStoreSdk(
  options: EdgeStoreSdkOptions,
): ProjectEdgeStoreSdk | ManagementEdgeStoreSdk {
  const transport = createTransport(options);
  const system = createSystemClient(transport);

  return 'token' in options.credentials
    ? {
        runtime: createExplicitProjectRuntimeClient(transport, options.upload),
        management: createManagementClient(transport),
        system,
      }
    : {
        runtime: createProjectRuntimeClient(transport, options.upload),
        system,
      };
}
