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
  credentials: ClassifiedCredentials,
): string {
  if (credentials.kind === 'management') {
    return `Bearer ${credentials.token}`;
  }

  const encodedCredentials = Buffer.from(
    `${credentials.accessKey}:${credentials.secretKey}`,
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
