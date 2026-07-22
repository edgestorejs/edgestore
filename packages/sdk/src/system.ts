import type { OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';

/** API availability operations. */
export type SystemClient = {
  /** Checks whether API v2 is available. Does not require valid credentials. */
  health(options?: {
    /** Cancels the request. */
    signal?: AbortSignal;
  }): Promise<OperationResult<'v2.health'>>;
};

export function createSystemClient(transport: Transport): SystemClient {
  return {
    health: (options) =>
      transport.execute((client) =>
        client.GET('/health', { signal: options?.signal }),
      ),
  };
}
