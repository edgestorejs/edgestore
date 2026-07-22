import type { OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';

/** API availability and credential-introspection operations. */
export type SystemClient = {
  /** Checks whether API v2 is available. Does not require valid credentials. */
  health(options?: {
    /** Cancels the request. */
    signal?: AbortSignal;
  }): Promise<OperationResult<'v2.health'>>;
  /** Describes the credential used by this SDK client. */
  whoami(options?: {
    /** Cancels the request. */
    signal?: AbortSignal;
  }): Promise<OperationResult<'v2.whoami'>>;
};

export function createSystemClient(transport: Transport): SystemClient {
  return {
    health: (options) =>
      transport.execute(() =>
        transport.client.GET('/health', { signal: options?.signal }),
      ),
    whoami: (options) =>
      transport.execute(() =>
        transport.client.GET('/whoami', { signal: options?.signal }),
      ),
  };
}
