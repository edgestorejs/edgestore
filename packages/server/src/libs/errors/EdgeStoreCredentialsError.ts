const DEFAULT_MESSAGE = `Missing EDGE_STORE_ACCESS_KEY or EDGE_STORE_SECRET_KEY. 
This can happen if you are trying to import something related to the backend of Edge Store in a client component.`;

class EdgeStoreCredentialsError extends Error {
  constructor(message = DEFAULT_MESSAGE) {
    super(message);
    this.name = 'EdgeStoreCredentialsError';
  }
}

export default EdgeStoreCredentialsError;
