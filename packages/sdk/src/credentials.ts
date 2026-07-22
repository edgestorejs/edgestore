/** Project-scoped credentials used by runtime API clients. */
export type ProjectCredentials = {
  /** Project access key. */
  accessKey: string;
  /** Project secret key. */
  secretKey: string;
  token?: never;
};

/** Management token used by administrative API clients. */
export type ManagementCredentials = {
  /** Account- or user-owned management token. */
  token: string;
  accessKey?: never;
  secretKey?: never;
};

/** Credentials accepted by {@link createEdgeStoreSdk}. */
export type EdgeStoreCredentials = ProjectCredentials | ManagementCredentials;

export function getAuthorizationHeader(
  credentials: EdgeStoreCredentials,
): string {
  if ('token' in credentials) {
    assertCredential(credentials.token, 'token');
    return `Bearer ${credentials.token}`;
  }

  assertCredential(credentials.accessKey, 'accessKey');
  assertCredential(credentials.secretKey, 'secretKey');

  const encodedCredentials = Buffer.from(
    `${credentials.accessKey}:${credentials.secretKey}`,
    'utf8',
  ).toString('base64');

  return `Basic ${encodedCredentials}`;
}

function assertCredential(
  value: string | undefined,
  name: string,
): asserts value is string {
  if (!value?.trim()) {
    throw new TypeError(`EdgeStore credential \`${name}\` must not be empty.`);
  }
}
