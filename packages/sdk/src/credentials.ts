export type ProjectCredentials = {
  accessKey: string;
  secretKey: string;
};

export type ManagementCredentials = {
  token: string;
};

export type EdgeStoreCredentials = ProjectCredentials | ManagementCredentials;

export type ClassifiedCredentials =
  | ({ kind: 'project' } & ProjectCredentials)
  | ({ kind: 'management' } & ManagementCredentials);

export function classifyCredentials(
  credentials: EdgeStoreCredentials,
): ClassifiedCredentials {
  const values = credentials as Record<string, unknown>;
  const token = values.token;
  const accessKey = values.accessKey;
  const secretKey = values.secretKey;

  if (token !== undefined) {
    if (accessKey !== undefined || secretKey !== undefined) {
      throw new TypeError(
        'EdgeStore credentials cannot contain both a management token and project keys.',
      );
    }
    assertCredential(token, 'token');
    return { kind: 'management', token };
  }

  assertCredential(accessKey, 'accessKey');
  assertCredential(secretKey, 'secretKey');
  return { kind: 'project', accessKey, secretKey };
}

export function getAuthorizationHeader(
  credentials: EdgeStoreCredentials | ClassifiedCredentials,
): string {
  const classified =
    'kind' in credentials ? credentials : classifyCredentials(credentials);

  if (classified.kind === 'management') {
    return `Bearer ${classified.token}`;
  }

  const encodedCredentials = Buffer.from(
    `${classified.accessKey}:${classified.secretKey}`,
    'utf8',
  ).toString('base64');

  return `Basic ${encodedCredentials}`;
}

function assertCredential(
  value: unknown,
  name: string,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`EdgeStore credential \`${name}\` must not be empty.`);
  }
}
