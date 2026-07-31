import type { OperationResult } from './internal/operationTypes';
import type { Transport } from './internal/transport';

export type SystemClient = {
  health(options?: {
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
