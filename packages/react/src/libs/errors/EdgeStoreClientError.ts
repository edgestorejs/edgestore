class EdgeStoreClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EdgeStoreError';
  }
}

export default EdgeStoreClientError;
