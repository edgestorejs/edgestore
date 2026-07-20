import type {
  EdgeStoreCredentials,
  ManagementCredentials,
  ProjectCredentials,
} from './credentials';
import { classifyCredentials } from './credentials';
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

export type EdgeStoreSdkOptions<
  TCredentials extends EdgeStoreCredentials = EdgeStoreCredentials,
> = {
  credentials: TCredentials;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
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
  options: EdgeStoreSdkOptions<EdgeStoreCredentials>,
): ProjectEdgeStoreSdk | ManagementEdgeStoreSdk;
export function createEdgeStoreSdk(
  options: EdgeStoreSdkOptions,
): ProjectEdgeStoreSdk | ManagementEdgeStoreSdk {
  const credentials = classifyCredentials(options.credentials);
  const transport = createTransport({ ...options, credentials });
  const system = createSystemClient(transport);

  return credentials.kind === 'management'
    ? {
        runtime: createExplicitProjectRuntimeClient(transport),
        management: createManagementClient(transport),
        system,
      }
    : { runtime: createProjectRuntimeClient(transport), system };
}
