const DEFAULT_MESSAGE = `Missing EDGESTORE_ACCESS_KEY or EDGESTORE_SECRET_KEY.
This can happen if you are trying to import something related to the backend of EdgeStore in a client component.`;

class EdgeStoreCredentialsError extends Error {
  constructor(message = DEFAULT_MESSAGE) {
    super(message);
    this.name = 'EdgeStoreCredentialsError';
  }
}

export default EdgeStoreCredentialsError;
