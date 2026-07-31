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

/** Complete administrative client available to management credentials. */
export type ManagementClient = ManagementResourceClient &
  ManagementAccessClient & {
    /** Describes the identity represented by the management credential. */
    whoami(options?: {
      /** Cancels the request. */
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
