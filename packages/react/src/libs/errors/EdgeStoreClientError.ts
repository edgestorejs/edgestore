class EdgeStoreClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeStoreClientError';
  }
}

export default EdgeStoreClientError;
