import type {
  EdgeStoreCredentials,
  ManagementCredentials,
  ProjectCredentials,
} from './credentials';
import { createTransport } from './internal/transport';
import { createManagementClient, type ManagementClient } from './management';
import {
  createExplicitProjectRuntimeClient,
  createProjectRuntimeClient,
  type ExplicitProjectRuntimeClient,
  type ProjectRuntimeClient,
} from './runtime';

export type EdgeStoreSdkOptions<
  TCredentials extends EdgeStoreCredentials = EdgeStoreCredentials,
> = {
  credentials: TCredentials;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
};

export type ProjectEdgeStoreSdk = { runtime: ProjectRuntimeClient };
export type ManagementEdgeStoreSdk = {
  runtime: ExplicitProjectRuntimeClient;
  management: ManagementClient;
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

  return 'token' in options.credentials
    ? {
        runtime: createExplicitProjectRuntimeClient(transport),
        management: createManagementClient(transport),
      }
    : { runtime: createProjectRuntimeClient(transport) };
}
