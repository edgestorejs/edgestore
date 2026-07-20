export type ProjectCredentials = {
  accessKey: string;
  secretKey: string;
  token?: never;
};

export type ManagementCredentials = {
  token: string;
  accessKey?: never;
  secretKey?: never;
};

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
