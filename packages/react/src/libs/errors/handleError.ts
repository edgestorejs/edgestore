import { EdgeStoreApiClientError } from '@edgestore/shared';
import EdgeStoreClientError from './EdgeStoreClientError';

export async function handleError(res: Response): Promise<never> {
  let json: any = {};
  try {
    json = await res.json();
  } catch (err) {
    throw new EdgeStoreClientError(
      `Failed to parse response. Make sure the api is correctly configured at ${res.url}`,
    );
  }
  throw new EdgeStoreApiClientError({ response: json });
}
