import type { OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';
import {
  createManagementAccessClient,
  type ManagementAccessClient,
} from './managementAccess';
import {
  createManagementResourceClient,
  type ManagementResourceClient,
} from './managementResources';

export type ManagementClient = ManagementResourceClient &
  ManagementAccessClient & {
    whoami(options?: {
      signal?: AbortSignal;
    }): Promise<OperationResult<'v2.whoami'>>;
  };

export function createManagementClient(transport: Transport): ManagementClient {
  return {
    ...createManagementResourceClient(transport),
    ...createManagementAccessClient(transport),
    whoami: (options) =>
      transport.execute((client) =>
        client.GET('/whoami', { signal: options?.signal }),
      ),
  };
}
