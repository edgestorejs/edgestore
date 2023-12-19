import { EdgeStoreApiClientError } from '@edgestore/shared';
import EdgeStoreClientError from './EdgeStoreClientError';

export async function handleError(res: Response): Promise<never> {
  try {
    const json = await res.json();
    throw new EdgeStoreApiClientError({ response: json });
  } catch (err) {
    throw new EdgeStoreClientError(
      `Failed to parse response. Make sure the api is correctly configured at ${res.url}`,
    );
  }
}
