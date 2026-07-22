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

/** Configuration shared by project- and management-credential SDK clients. */
export type EdgeStoreSdkOptions<
  TCredentials extends EdgeStoreCredentials = EdgeStoreCredentials,
> = {
  /** Credentials that determine which SDK resources are available. */
  credentials: TCredentials;
  /** EdgeStore API base URL. Defaults to the hosted API v2 endpoint. */
  baseUrl?: string;
  /** Fetch implementation used for API requests and upload transfers. */
  fetch?: typeof globalThis.fetch;
  /** Defaults used by the high-level upload helpers. */
  upload?: UploadDefaults;
  /**
   * Default timeout for API control-plane requests, in milliseconds.
   *
   * Set to `0` to disable the SDK timeout. Pass an `AbortSignal` to a call to
   * impose a shorter deadline or cancel it explicitly.
   *
   * @defaultValue 30000
   */
  controlTimeoutMs?: number;
};

/** SDK resources available when using project credentials. */
export type ProjectEdgeStoreSdk = {
  runtime: ProjectRuntimeClient;
  system: SystemClient;
};

/** SDK resources available when using a management token. */
export type ManagementEdgeStoreSdk = {
  runtime: ExplicitProjectRuntimeClient;
  management: ManagementClient;
  system: SystemClient;
};

/**
 * Creates an EdgeStore API v2 client.
 *
 * Project credentials expose runtime operations scoped to their project.
 * Management tokens additionally expose management operations and require an
 * explicit project selector for runtime calls.
 */
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
