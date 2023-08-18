const DEFAULT_MESSAGE = `Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY. 
This can happen if you are trying to use the vanilla client in your frontend.
The vanilla client should only be used in the backend.`;

class EdgeStoreCredentialsError extends Error {
  constructor(message = DEFAULT_MESSAGE) {
    super(message);
    this.name = 'EdgeStoreCredentialsError';
  }
}

export default EdgeStoreCredentialsError;
