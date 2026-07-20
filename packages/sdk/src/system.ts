import type { OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';

export type SystemClient = {
  health(options?: {
    signal?: AbortSignal;
  }): Promise<OperationResult<'v2.health'>>;
  whoami(options?: {
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
