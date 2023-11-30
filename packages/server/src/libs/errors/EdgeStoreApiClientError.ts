/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { type EdgeStoreJsonResponse } from './EdgeStoreError';

export class EdgeStoreApiClientError extends Error {
  public readonly data: EdgeStoreJsonResponse;

  constructor(opts: { response: EdgeStoreJsonResponse }) {
    super(opts.response.message);
    this.name = 'EdgeStoreApiClientError';

    this.data = opts.response;
  }
}
