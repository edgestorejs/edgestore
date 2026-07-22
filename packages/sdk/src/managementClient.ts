import type { Transport } from './internal/transport';
import {
  createManagementAccessClient,
  type ManagementAccessClient,
} from './managementAccess';
import {
  createManagementResourceClient,
  type ManagementResourceClient,
} from './managementResources';

/** Complete administrative client available to management credentials. */
export type ManagementClient = ManagementResourceClient &
  ManagementAccessClient;

export function createManagementClient(transport: Transport): ManagementClient {
  return {
    ...createManagementResourceClient(transport),
    ...createManagementAccessClient(transport),
  };
}
